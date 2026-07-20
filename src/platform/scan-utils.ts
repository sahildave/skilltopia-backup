import type { InstalledScanSnapshot, SkillEntry, SkillProvider } from './types'

/** Back-compat SkillEntry list derived from a scan snapshot. */
export function skillEntriesFromScan(
  snapshot: InstalledScanSnapshot
): SkillEntry[] {
  return snapshot.skills
    .map(skill => ({
      name: skill.name,
      isDirectory: true,
      isFile: false,
      isSymlink: false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function providersFromScan(
  snapshot: InstalledScanSnapshot
): SkillProvider[] {
  return snapshot.providers.map(provider => ({
    id: provider.id,
    name: provider.name,
  }))
}

export const EMPTY_INSTALLED_SCAN: InstalledScanSnapshot = {
  scannedAt: '',
  source: {
    repositoryUrl: 'https://github.com/vercel-labs/skills',
    commit: '',
    license: 'MIT',
    attribution: '',
  },
  universal: {
    skillsDir: '',
    skillsDirExists: false,
    skillCount: 0,
  },
  providers: [],
  skills: [],
  warnings: [],
}
