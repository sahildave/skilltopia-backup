import { enforceRateLimit, methodNotAllowed, proxySkillsRequest } from '../_lib/proxy.js';
import { mergeHybridSearchResults } from '../_lib/hybrid-search.js';
import { searchSkillsByText } from '../_lib/qdrant.js';
import {
  createSupabaseRepositoryFromEnv,
  type SkillMetadataRecord,
} from '../_lib/supabase-repository.js';
import { parseSkillsSearchQuery } from '../_lib/query.js';
import { toSkillCategories } from '../_lib/taxonomy.js';

const MAX_KEYWORD_LIMIT = 200;
const KEYWORD_OVERFETCH_FACTOR = 4;

function responseWithSearchData(
  keywordResponse: Response,
  keywordBody: Record<string, unknown>,
  data: unknown[],
  semanticUnavailable: boolean,
): Response {
  const headers = new Headers(keywordResponse.headers);
  headers.set('Content-Type', 'application/json');
  return new Response(
    JSON.stringify({
      ...keywordBody,
      data,
      count: data.length,
      ...(semanticUnavailable ? { semanticUnavailable: true } : {}),
    }),
    {
      status: keywordResponse.status,
      headers,
    },
  );
}

/**
 * Searches skills.sh keywords and merges semantic matches from the enriched
 * Qdrant subset. Semantic search is best-effort so keyword search remains
 * available when the vector store is empty or unavailable.
 * Query allowlist: q, limit, owner, category
 */
export async function GET(request: Request): Promise<Response> {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  const parsed = parseSkillsSearchQuery(new URL(request.url).searchParams);
  if (!parsed.ok) {
    return Response.json(parsed.body, { status: parsed.status });
  }

  // `category` is our own semantic-side facet; skills.sh keyword search does
  // not understand it, so keep it out of the proxied query.
  const keywordQuery = new URLSearchParams(parsed.query);
  keywordQuery.delete('category');
  const limit = Number(parsed.query.get('limit') ?? 50);
  const categories = toSkillCategories(parsed.query.get('category')?.split(',') ?? []);
  if (categories.length) {
    keywordQuery.set(
      'limit',
      String(Math.min(MAX_KEYWORD_LIMIT, Math.max(limit, limit * KEYWORD_OVERFETCH_FACTOR))),
    );
  }
  const keywordResponse = await proxySkillsRequest('/skills/search', keywordQuery);
  if (!keywordResponse.ok) return keywordResponse;

  const keywordBody = (await keywordResponse.json()) as Record<string, unknown> & {
    data?: unknown;
  };
  const keywordResults = (Array.isArray(keywordBody.data) ? keywordBody.data : []).filter(
    (result): result is { id: string; installs: number } =>
      typeof result === 'object' &&
      result !== null &&
      typeof result.id === 'string' &&
      typeof result.installs === 'number',
  );
  const owner = parsed.query.get('owner');

  let semanticResults: Awaited<ReturnType<typeof searchSkillsByText>> = [];
  let semanticUnavailable = false;
  try {
    semanticResults = await searchSkillsByText(parsed.query.get('q')!, limit, categories);
  } catch {
    semanticUnavailable = true;
  }

  const metadataIds = [
    ...new Set([
      ...semanticResults.map((result) => result.skillId),
      ...keywordResults.map((result) => result.id),
    ]),
  ];
  let metadata: SkillMetadataRecord[] = [];
  try {
    const repository = createSupabaseRepositoryFromEnv();
    // Keyword ids are hydrated too: they need their categories in the response
    // even though they are ranked without help from the enrichment record.
    metadata = (await repository.getSkillMetadata(metadataIds)).filter(
      (item) => !owner || item.skillId.split('/')[0] === owner,
    );
  } catch {
    if (categories.length) {
      return Response.json(
        {
          error: 'category_metadata_unavailable',
          message: 'Category metadata is temporarily unavailable. Try again shortly.',
        },
        { status: 503 },
      );
    }
  }

  const merged = mergeHybridSearchResults(
    parsed.query.get('q')!,
    keywordResults,
    semanticResults,
    metadata.map((item) => ({
      skillId: item.skillId,
      source: item.repository,
      installCount: item.installCount,
      sourceUrl: item.sourceUrl,
      categories: toSkillCategories(item.optional?.categories),
    })),
    limit,
    categories,
  );
  return responseWithSearchData(keywordResponse, keywordBody, merged, semanticUnavailable);
}

export async function POST(): Promise<Response> {
  return methodNotAllowed();
}
