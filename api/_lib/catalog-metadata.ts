import type { SkillCategory } from './taxonomy.js';
import { toSkillCategories } from './taxonomy.js';
import type { SkillMetadataRecord } from './supabase-repository.js';

type CatalogSkillWithId = {
  id: string;
};

type CategoryMetadata = Pick<SkillMetadataRecord, 'skillId' | 'optional'>;

export function categoriesFromMetadata(
  metadata: Pick<SkillMetadataRecord, 'optional'> | null | undefined,
): SkillCategory[] {
  return toSkillCategories(metadata?.optional?.categories);
}

/** Attach verified enrichment categories while preserving the catalog row shape and order. */
export function hydrateCatalogSkills<T extends CatalogSkillWithId>(
  skills: readonly T[],
  metadata: readonly CategoryMetadata[],
): Array<T & { categories: SkillCategory[] }> {
  const metadataById = new Map(metadata.map((item) => [item.skillId, item]));

  return skills.map((skill) => ({
    ...skill,
    categories: categoriesFromMetadata(metadataById.get(skill.id)),
  }));
}
