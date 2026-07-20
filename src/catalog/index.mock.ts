import type { CatalogPort } from './types';
import { MOCK_DETAIL, MOCK_LEADERBOARD } from './fixtures';

export const catalog: CatalogPort = {
  async fetchLeaderboard(_view, _page, perPage) {
    return MOCK_LEADERBOARD.slice(0, perPage);
  },

  async search(query, limit) {
    const q = query.trim().toLowerCase();
    return MOCK_LEADERBOARD.filter(
      (skill) =>
        skill.name.toLowerCase().includes(q) ||
        skill.slug.toLowerCase().includes(q) ||
        skill.source.toLowerCase().includes(q),
    ).slice(0, limit);
  },

  async fetchDetail(skillId) {
    if (skillId === MOCK_DETAIL.skillId) return MOCK_DETAIL;
    return { skillId, enrichment: null, related: [] };
  },
};
