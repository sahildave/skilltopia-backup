import type { SimilarSkill } from './qdrant.js';
import type { SkillCategory } from './taxonomy.js';

export type SearchResult = {
  id: string;
  installs: number;
  [key: string]: unknown;
};

export type EnrichedSearchResult = SearchResult & {
  semanticScore?: number;
};

export type SkillSearchMetadata = {
  skillId: string;
  source?: string;
  installCount?: number;
  sourceUrl?: string;
  categories?: SkillCategory[];
};

const INSTALL_BOOST_SCALE = 0.05;

function installBoost(installs: number): number {
  return Math.log10(Math.max(0, installs) + 1) * INSTALL_BOOST_SCALE;
}

function normalizedText(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function rankKeywordResult(result: SearchResult, query: string): number {
  const normalizedQuery = normalizedText(query);
  const normalizedId = normalizedText(result.id);
  const exactBoost = normalizedId === normalizedQuery ? 2 : 0;
  const tokenBoost = normalizedId.includes(normalizedQuery) ? 1 : 0;
  return exactBoost + tokenBoost + installBoost(result.installs);
}

function rankSemanticResult(result: SimilarSkill, installs: number): number {
  return result.score + installBoost(installs);
}

export function mergeHybridSearchResults(
  query: string,
  keywordResults: SearchResult[],
  semanticResults: SimilarSkill[],
  metadata: SkillSearchMetadata[],
  limit: number,
  categories: readonly SkillCategory[] = [],
): EnrichedSearchResult[] {
  const metadataById = new Map(metadata.map((item) => [item.skillId, item]));
  const keywordIds = new Set(keywordResults.map((result) => result.id));
  const keyword = [...keywordResults]
    .sort((left, right) => {
      const difference = rankKeywordResult(right, query) - rankKeywordResult(left, query);
      return difference || keywordResults.indexOf(left) - keywordResults.indexOf(right);
    })
    .map((result) => ({
      ...result,
      categories: metadataById.get(result.id)?.categories ?? [],
    }))
    .filter(
      (result) =>
        categories.length === 0 ||
        result.categories.some((category) => categories.includes(category)),
    );

  const semantic = semanticResults
    .filter((result) => !keywordIds.has(result.skillId))
    .flatMap((result) => {
      const item = metadataById.get(result.skillId);
      if (!item) return [];
      if (
        categories.length > 0 &&
        !item.categories?.some((category) => categories.includes(category))
      ) {
        return [];
      }
      return [
        {
          id: item.skillId,
          slug: item.skillId.split('/').at(-1) ?? item.skillId,
          name: item.skillId.split('/').at(-1) ?? item.skillId,
          source: item.source ?? item.skillId.split('/')[0] ?? '',
          installs: item.installCount ?? 0,
          sourceType: 'github',
          installUrl: null,
          url: item.sourceUrl ?? `https://skills.sh/skills/${item.skillId}`,
          categories: item.categories ?? [],
          semanticScore: rankSemanticResult(result, item.installCount ?? 0),
        },
      ];
    })
    .sort((left, right) => right.semanticScore - left.semanticScore);

  return [...keyword, ...semantic].slice(0, limit);
}
