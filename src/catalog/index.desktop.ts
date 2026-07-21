import { commands, unwrapResult } from '@/lib/tauri-bindings';
import type { CatalogPort, SkillAuditsData, SkillDetailData } from './types';

export const catalog: CatalogPort = {
  async fetchLeaderboard(view, page, perPage) {
    return unwrapResult(await commands.fetchSkillsLeaderboard(view, page, perPage));
  },

  async search(query, limit) {
    return unwrapResult(await commands.searchSkills(query, limit));
  },

  async fetchDetail(skillId) {
    const data = unwrapResult(await commands.fetchSkillDetail(skillId));
    return {
      skillId: data.skillId,
      pageSnapshot: data.pageSnapshot ?? null,
      pageScrapedAt: data.pageScrapedAt ?? null,
      repository: data.repository ?? null,
      source: data.source ?? null,
      installCount: data.installCount ?? null,
      sourceUrl: data.sourceUrl ?? null,
      installSeries: data.installSeries ?? [],
      enrichment: data.enrichment,
      related: data.related,
    } as SkillDetailData;
  },

  async fetchAudits(skillId) {
    return unwrapResult(await commands.fetchSkillAudits(skillId)) as SkillAuditsData;
  },
};
