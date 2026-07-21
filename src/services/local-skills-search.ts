import type { SkillsShSkill } from '@/catalog/types';
import type { QueryClient } from '@tanstack/react-query';
import { skillsShQueryKeys } from './skills-sh';

export type LeaderboardCacheEntry = {
  data: SkillsShSkill[] | undefined;
  dataUpdatedAt: number;
};

function dedupeById(skills: SkillsShSkill[]): SkillsShSkill[] {
  const seen = new Set<string>();
  const result: SkillsShSkill[] = [];
  for (const skill of skills) {
    if (seen.has(skill.id)) continue;
    seen.add(skill.id);
    result.push(skill);
  }
  return result;
}

/**
 * Prefer leaderboard cache entries that were actually fetched (`dataUpdatedAt > 0`).
 * If none exist yet, fall back to the active tab's seed-backed skills.
 */
export function collectCachedLeaderboardSkills(
  entries: LeaderboardCacheEntry[],
  fallback?: SkillsShSkill[],
): SkillsShSkill[] {
  const fetched = entries.filter(
    (entry): entry is LeaderboardCacheEntry & { data: SkillsShSkill[] } =>
      entry.dataUpdatedAt > 0 && Array.isArray(entry.data),
  );

  if (fetched.length > 0) {
    return dedupeById(fetched.flatMap((entry) => entry.data));
  }

  return fallback ? dedupeById(fallback) : [];
}

export function collectCachedLeaderboardSkillsFromClient(
  queryClient: QueryClient,
  fallback?: SkillsShSkill[],
): SkillsShSkill[] {
  const queries = queryClient.getQueryCache().findAll({
    queryKey: [...skillsShQueryKeys.all, 'leaderboard'],
  });

  return collectCachedLeaderboardSkills(
    queries.map((query) => ({
      data: query.state.data as SkillsShSkill[] | undefined,
      dataUpdatedAt: query.state.dataUpdatedAt,
    })),
    fallback,
  );
}

export function filterSkillsLocally(skills: SkillsShSkill[], query: string): SkillsShSkill[] {
  const needle = query.trim().toLowerCase();
  if (needle.length < 2) return [];

  return skills.filter((skill) => {
    return (
      skill.name.toLowerCase().includes(needle) ||
      skill.slug.toLowerCase().includes(needle) ||
      skill.source.toLowerCase().includes(needle)
    );
  });
}

/** Local order first; append API-only skills by `id`. */
export function mergeLocalAndApiSkills(
  local: SkillsShSkill[],
  api: SkillsShSkill[],
): SkillsShSkill[] {
  const seen = new Set(local.map((skill) => skill.id));
  return [...local, ...api.filter((skill) => !seen.has(skill.id))];
}

/** Merge only when debounced query equals current input (avoid mid-typing stale merges). */
export function shouldMergeApiResults(currentInput: string, debouncedQuery: string): boolean {
  return currentInput.trim() === debouncedQuery.trim();
}
