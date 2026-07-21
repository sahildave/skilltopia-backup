import type { SkillsShSkill } from '@/catalog/types';
import { getSeedDetail, getSeedForView } from '@/data/skills-seed';
import { logger } from '@/lib/logger';
import { catalog } from '@catalog';
import { keepPreviousData, useQuery } from '@tanstack/react-query';

export const skillsShQueryKeys = {
  all: ['skills-sh'] as const,
  leaderboard: (view: string, perPage: number) =>
    [...skillsShQueryKeys.all, 'leaderboard', view, perPage] as const,
  search: (query: string, limit: number) =>
    [...skillsShQueryKeys.all, 'search', query, limit] as const,
  detail: (skillId: string) => [...skillsShQueryKeys.all, 'detail', skillId] as const,
  audits: (skillId: string) => [...skillsShQueryKeys.all, 'audits', skillId] as const,
};

export const DISCOVERY_VIEWS = [
  { id: 'trending', label: 'Trending' },
  { id: 'hot', label: 'Hot' },
  { id: 'all-time', label: 'Top' },
] as const;

export type DiscoveryViewId = (typeof DISCOVERY_VIEWS)[number]['id'];

const LEADERBOARD_STALE_MS = 1000 * 60;
const SEARCH_STALE_MS = 1000 * 30;

export function useSkillsLeaderboard(options?: {
  view?: string;
  perPage?: number;
  enabled?: boolean;
}) {
  const view = options?.view ?? 'all-time';
  const perPage = options?.perPage ?? 500;
  const enabled = options?.enabled ?? true;

  return useQuery({
    queryKey: skillsShQueryKeys.leaderboard(view, perPage),
    queryFn: async (): Promise<SkillsShSkill[]> => {
      logger.debug('Fetching skills.sh leaderboard', { view, perPage });
      const skills = await catalog.fetchLeaderboard(view, 0, perPage);
      logger.info('skills.sh leaderboard loaded', { count: skills.length });
      return skills;
    },
    enabled,
    initialData: () => getSeedForView(view),
    initialDataUpdatedAt: 0,
    staleTime: LEADERBOARD_STALE_MS,
    gcTime: 1000 * 60 * 10,
  });
}

export function useSkillsSearch(query: string, options?: { limit?: number; enabled?: boolean }) {
  const limit = options?.limit ?? 50;
  const trimmed = query.trim();
  const enabled = (options?.enabled ?? true) && trimmed.length >= 2;

  return useQuery({
    queryKey: skillsShQueryKeys.search(trimmed, limit),
    queryFn: async (): Promise<SkillsShSkill[]> => {
      logger.debug('Searching skills.sh', { query: trimmed, limit });
      const skills = await catalog.search(trimmed, limit);
      logger.info('skills.sh search complete', { count: skills.length });
      return skills;
    },
    enabled,
    placeholderData: keepPreviousData,
    staleTime: SEARCH_STALE_MS,
    gcTime: 1000 * 60 * 5,
  });
}

export function useSkillDetail(skillId: string | null) {
  return useQuery({
    queryKey: skillsShQueryKeys.detail(skillId ?? ''),
    queryFn: async () => {
      if (!skillId) throw new Error('Skill ID is required.');
      return catalog.fetchDetail(skillId);
    },
    enabled: Boolean(skillId),
    initialData: () => (skillId ? getSeedDetail(skillId) : undefined),
    initialDataUpdatedAt: 0,
    staleTime: 1000 * 60 * 10,
    gcTime: 1000 * 60 * 30,
  });
}

const AUDITS_STALE_MS = 1000 * 60 * 10;

export function useSkillAudits(skillId: string | null) {
  return useQuery({
    queryKey: skillsShQueryKeys.audits(skillId ?? ''),
    queryFn: async () => {
      if (!skillId) throw new Error('Skill ID is required.');
      return catalog.fetchAudits(skillId);
    },
    enabled: Boolean(skillId),
    staleTime: AUDITS_STALE_MS,
    gcTime: 1000 * 60 * 30,
  });
}
