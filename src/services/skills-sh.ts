import { useQuery } from '@tanstack/react-query'
import { logger } from '@/lib/logger'
import {
  commands,
  unwrapResult,
  type SkillsShSkill,
} from '@/lib/tauri-bindings'

export const skillsShQueryKeys = {
  all: ['skills-sh'] as const,
  leaderboard: (view: string, perPage: number) =>
    [...skillsShQueryKeys.all, 'leaderboard', view, perPage] as const,
  search: (query: string, limit: number) =>
    [...skillsShQueryKeys.all, 'search', query, limit] as const,
}

const LEADERBOARD_STALE_MS = 1000 * 60
const SEARCH_STALE_MS = 1000 * 30

export function useSkillsLeaderboard(options?: {
  view?: string
  perPage?: number
  enabled?: boolean
}) {
  const view = options?.view ?? 'all-time'
  const perPage = options?.perPage ?? 500
  const enabled = options?.enabled ?? true

  return useQuery({
    queryKey: skillsShQueryKeys.leaderboard(view, perPage),
    queryFn: async (): Promise<SkillsShSkill[]> => {
      logger.debug('Fetching skills.sh leaderboard', { view, perPage })
      const skills = unwrapResult(
        await commands.fetchSkillsLeaderboard(view, 0, perPage)
      )
      logger.info('skills.sh leaderboard loaded', { count: skills.length })
      return skills
    },
    enabled,
    staleTime: LEADERBOARD_STALE_MS,
    gcTime: 1000 * 60 * 10,
  })
}

export function useSkillsSearch(
  query: string,
  options?: { limit?: number; enabled?: boolean }
) {
  const limit = options?.limit ?? 50
  const trimmed = query.trim()
  const enabled = (options?.enabled ?? true) && trimmed.length >= 2

  return useQuery({
    queryKey: skillsShQueryKeys.search(trimmed, limit),
    queryFn: async (): Promise<SkillsShSkill[]> => {
      logger.debug('Searching skills.sh', { query: trimmed, limit })
      const skills = unwrapResult(await commands.searchSkills(trimmed, limit))
      logger.info('skills.sh search complete', { count: skills.length })
      return skills
    },
    enabled,
    staleTime: SEARCH_STALE_MS,
    gcTime: 1000 * 60 * 5,
  })
}
