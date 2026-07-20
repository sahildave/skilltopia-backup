import type { SkillsShSkill } from '@/catalog/types';
import type { InstalledScanSnapshot, ScannedSkill } from '@/platform/types';

/** Local folder / frontmatter keys used to match catalog skills. */
export function installedSkillKeysFromSkills(skills: ScannedSkill[]): Set<string> {
  const keys = new Set<string>();
  for (const skill of skills) {
    keys.add(skill.uninstallName);
    keys.add(skill.name);
  }
  return keys;
}

export function installedSkillKeysFromSnapshot(
  snapshot: InstalledScanSnapshot | null | undefined,
): Set<string> {
  if (!snapshot) return new Set();
  return installedSkillKeysFromSkills(snapshot.skills);
}

/** Slug / folder match: catalog `slug` (or id tail) against local uninstallName / name. */
export function isCatalogSkillInstalled(skill: SkillsShSkill, keys: Set<string>): boolean {
  if (keys.has(skill.slug)) return true;
  const idTail = skill.id.split('/').filter(Boolean).at(-1);
  return idTail !== undefined && keys.has(idTail);
}
