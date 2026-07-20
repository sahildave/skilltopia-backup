import { commands, unwrapResult } from '@/lib/tauri-bindings'
import type { CatalogPort } from './types'

export const catalog: CatalogPort = {
  async fetchLeaderboard(view, page, perPage) {
    return unwrapResult(
      await commands.fetchSkillsLeaderboard(view, page, perPage)
    )
  },

  async search(query, limit) {
    return unwrapResult(await commands.searchSkills(query, limit))
  },

  async fetchDetail(skillId) {
    return unwrapResult(await commands.fetchSkillDetail(skillId))
  },
}
