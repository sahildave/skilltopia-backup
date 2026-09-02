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

/** Map local uninstallName / name → scanned skill. First skill wins on key collision. */
export function scannedSkillsByKey(skills: ScannedSkill[]): Map<string, ScannedSkill> {
  const map = new Map<string, ScannedSkill>();
  for (const skill of skills) {
    if (!map.has(skill.uninstallName)) {
      map.set(skill.uninstallName, skill);
    }
    if (!map.has(skill.name)) {
      map.set(skill.name, skill);
    }
  }
  return map;
}

/** Resolve the local scan row for a catalog skill (same key rules as {@link isCatalogSkillInstalled}). */
export function findScannedSkillForCatalog(
  skill: SkillsShSkill,
  byKey: ReadonlyMap<string, ScannedSkill>,
): ScannedSkill | undefined {
  const bySlug = byKey.get(skill.slug);
  if (bySlug) return bySlug;
  const idTail = skill.id.split('/').filter(Boolean).at(-1);
  return idTail !== undefined ? byKey.get(idTail) : undefined;
}

/**
 * The folder name a catalog skill installs as — the last segment of its id,
 * matching what the Rust install writes to disk.
 */
export function catalogInstallName(skill: SkillsShSkill): string | undefined {
  return skill.id.split('/').filter(Boolean).at(-1);
}

/** Local keys a catalog skill can be matched by (same rules as {@link isCatalogSkillInstalled}). */
function catalogSkillKeys(skill: SkillsShSkill): Set<string> {
  const keys = new Set<string>();
  if (skill.slug) keys.add(skill.slug);
  const idTail = skill.id.split('/').filter(Boolean).at(-1);
  if (idTail) keys.add(idTail);
  return keys;
}

/**
 * Map local uninstallName / name keys → catalog `source` (owner/repo).
 * First catalog hit wins when multiple skills share a slug.
 */
export function catalogSourcesByInstalledKey(catalogSkills: SkillsShSkill[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const skill of catalogSkills) {
    const source = skill.source.trim();
    if (!source) continue;

    for (const key of catalogSkillKeys(skill)) {
      if (!map.has(key)) {
        map.set(key, source);
      }
    }
  }
  return map;
}

/** Map local uninstallName / name keys → catalog skill. First catalog hit wins. */
export function catalogSkillsByInstalledKey(
  catalogSkills: SkillsShSkill[],
): Map<string, SkillsShSkill> {
  const map = new Map<string, SkillsShSkill>();
  for (const skill of catalogSkills) {
    for (const key of catalogSkillKeys(skill)) {
      if (!map.has(key)) {
        map.set(key, skill);
      }
    }
  }
  return map;
}

/** Resolve the catalog entry for an installed skill, when the catalog knows it. */
export function findCatalogSkillForInstalled(
  skill: ScannedSkill,
  byKey: ReadonlyMap<string, SkillsShSkill>,
): SkillsShSkill | undefined {
  return byKey.get(skill.uninstallName) ?? byKey.get(skill.name);
}

export function catalogSourceForScannedSkill(
  skill: ScannedSkill,
  sourcesByKey: ReadonlyMap<string, string>,
): string | undefined {
  return sourcesByKey.get(skill.uninstallName) ?? sourcesByKey.get(skill.name);
}
