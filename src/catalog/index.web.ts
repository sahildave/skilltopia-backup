import type { CatalogPort, SkillAuditsData, SkillDetailData, SkillsShSkill } from './types';

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Catalog request failed (${response.status}): ${body || response.statusText}`);
  }
  return (await response.json()) as T;
}

export const catalog: CatalogPort = {
  async fetchLeaderboard(view, page, perPage) {
    const params = new URLSearchParams({
      view,
      page: String(page),
      per_page: String(perPage),
    });
    const json = await readJson<{ data: SkillsShSkill[] }>(await fetch(`/api/skills?${params}`));
    return json.data;
  },

  async search(query, limit, categories) {
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
    });
    if (categories.length) params.set('category', categories.join(','));
    const json = await readJson<{ data: SkillsShSkill[] }>(
      await fetch(`/api/skills/search?${params}`),
    );
    return json.data;
  },

  async fetchDetail(skillId) {
    const params = new URLSearchParams({ skill_id: skillId });
    const json = await readJson<{ data: SkillDetailData }>(
      await fetch(`/api/skills/detail?${params}`),
    );
    return json.data;
  },

  async fetchAudits(skillId) {
    const params = new URLSearchParams({ skill_id: skillId });
    const json = await readJson<{ data: SkillAuditsData }>(
      await fetch(`/api/skills/audit?${params}`),
    );
    return json.data;
  },
};
