import { commands, unwrapResult } from '@/lib/tauri-bindings';
import type { SkillsShSkill as BindingsSkillsShSkill } from '@/lib/bindings';
import { toSkillCategories } from '../../api/_lib/taxonomy';
import type { CatalogPort, SkillAuditsData, SkillDetailData, SkillsShSkill } from './types';

/**
 * Rust carries the taxonomy slugs untyped. Narrowing keeps their order, so the
 * primary category stays first.
 */
function narrowCategories(skill: BindingsSkillsShSkill): SkillsShSkill {
  return { ...skill, categories: toSkillCategories(skill.categories) };
}

export const catalog: CatalogPort = {
  async fetchLeaderboard(view, page, perPage) {
    const skills = unwrapResult(await commands.fetchSkillsLeaderboard(view, page, perPage));
    return skills.map(narrowCategories);
  },

  async search(query, limit, categories) {
    const skills = unwrapResult(await commands.searchSkills(query, limit, categories));
    return skills.map(narrowCategories);
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
