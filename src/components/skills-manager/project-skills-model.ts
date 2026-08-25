import type { InstalledScanSnapshot, ScannedSkill } from '@/platform/types';

/**
 * Which skills a project view lists. A project can reach both its own skills
 * and everything installed globally, so the project scan alone under-reports
 * what an agent can invoke while working in that repo.
 */
export type ProjectSkillScope = 'all' | 'universal' | 'project';

/** Where a listed skill comes from, relative to the selected project. */
export type ProjectSkillOrigin = 'universal' | 'project' | 'both';

export interface ProjectSkillRow {
  skill: ScannedSkill;
  /**
   * The snapshot the skill was scanned from. Actions (uninstall, copy) resolve
   * paths against it, so a merged list has to carry it per row.
   */
  snapshot: InstalledScanSnapshot;
  origin: ProjectSkillOrigin;
}

function rowsFrom(
  snapshot: InstalledScanSnapshot | null,
  origin: ProjectSkillOrigin,
): ProjectSkillRow[] {
  if (!snapshot) return [];
  return snapshot.skills.map((skill) => ({ skill, snapshot, origin }));
}

/**
 * Merge the global and project scans for one scope, deduped by skill name.
 * The project copy wins a name collision — it is the one that shadows the
 * global skill in that repo — and the row is marked as living in both.
 */
export function projectSkillRows(
  projectSnapshot: InstalledScanSnapshot | null,
  globalSnapshot: InstalledScanSnapshot | null,
  scope: ProjectSkillScope,
): ProjectSkillRow[] {
  if (scope === 'project') return rowsFrom(projectSnapshot, 'project');
  if (scope === 'universal') return rowsFrom(globalSnapshot, 'universal');

  const globalNames = new Set((globalSnapshot?.skills ?? []).map((skill) => skill.name));
  const projectNames = new Set((projectSnapshot?.skills ?? []).map((skill) => skill.name));

  return [
    ...rowsFrom(projectSnapshot, 'project').map((row) =>
      globalNames.has(row.skill.name) ? { ...row, origin: 'both' as const } : row,
    ),
    ...rowsFrom(globalSnapshot, 'universal').filter((row) => !projectNames.has(row.skill.name)),
  ].sort((a, b) => a.skill.name.localeCompare(b.skill.name));
}

export function filterProjectSkillRows(rows: ProjectSkillRow[], query: string): ProjectSkillRow[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return rows;
  return rows.filter(({ skill }) =>
    [skill.name, skill.description, ...skill.providerIds].some((value) =>
      value.toLocaleLowerCase().includes(normalized),
    ),
  );
}
