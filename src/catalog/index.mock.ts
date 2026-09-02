import type { CatalogPort } from './types';
import { MOCK_AUDITS, MOCK_DETAIL, MOCK_LEADERBOARD, MOCK_UNCACHED_DETAIL } from './fixtures';

export const catalog: CatalogPort = {
  async fetchLeaderboard(_view, _page, perPage) {
    return MOCK_LEADERBOARD.slice(0, perPage);
  },

  async search(query, limit, categories) {
    const q = query.trim().toLowerCase();
    const skills = MOCK_LEADERBOARD.filter(
      (skill) =>
        (skill.name.toLowerCase().includes(q) ||
          skill.slug.toLowerCase().includes(q) ||
          skill.source.toLowerCase().includes(q)) &&
        (categories.length === 0 ||
          categories.some((category) => skill.categories?.includes(category))),
    ).slice(0, limit);
    return { skills, semanticUnavailable: false };
  },

  async fetchDetail(skillId) {
    if (skillId === MOCK_DETAIL.skillId) return MOCK_DETAIL;
    if (skillId === MOCK_UNCACHED_DETAIL.skillId) return MOCK_UNCACHED_DETAIL;
    return {
      skillId,
      pageSnapshot: null,
      pageScrapedAt: null,
      repository: null,
      source: null,
      installCount: null,
      sourceUrl: null,
      installSeries: [],
      enrichment: null,
      related: [],
    };
  },

  async fetchAudits(skillId) {
    if (skillId === MOCK_AUDITS.skillId) return MOCK_AUDITS;
    return { skillId, audits: null, source: 'cache', auditsFetchedAt: null };
  },
};
