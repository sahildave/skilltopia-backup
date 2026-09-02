import type { SkillsShSkill } from '@/catalog/types';
import { isSkillCategory, SKILL_CATEGORIES, type SkillCategory } from '../../../api/_lib/taxonomy';

export type SkillCategoryCounts = Record<SkillCategory, number>;

export function countSkillCategories(skills: readonly SkillsShSkill[]): SkillCategoryCounts {
  const counts = Object.fromEntries(
    SKILL_CATEGORIES.map((category) => [category, 0]),
  ) as SkillCategoryCounts;

  for (const skill of skills) {
    for (const category of new Set(skill.categories ?? [])) {
      if (isSkillCategory(category)) counts[category] += 1;
    }
  }

  return counts;
}

export function filterSkillsByCategory(
  skills: readonly SkillsShSkill[],
  category: SkillCategory | null,
): SkillsShSkill[] {
  if (!category) return [...skills];
  return skills.filter((skill) => skill.categories?.includes(category));
}
