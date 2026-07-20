import { providerRegistry } from '@/providers'
import type {
  InstalledScanSnapshot,
  ScannedProvider,
  ScannedSkill,
  ScanWarning,
} from '@/platform/types'
import { UNIVERSAL_PROVIDER_ID } from '@/platform/types'

/** Session selection for the Installed Skills provider filter. */
export type ProviderFilterId = 'all' | typeof UNIVERSAL_PROVIDER_ID | string

export const ALL_AGENTS_FILTER_ID = 'all' as const

export interface ProviderSidebarItem {
  id: ProviderFilterId
  name: string
  skillCount: number
  skillsDir: string | null
  skillsDirExists: boolean
  /** True when this row is Universal or a detected provider. */
  active: boolean
  warnings: ScanWarning[]
}

export interface ProviderSidebarModel {
  allAgentsCount: number
  universal: ProviderSidebarItem
  activeProviders: ProviderSidebarItem[]
  inactiveProviders: ProviderSidebarItem[]
}

export interface FilteredSkillSections {
  /** Primary list for the current filter. */
  primary: ScannedSkill[]
  /** Optional Universal Skills section (Show all Universal). */
  universalSection: ScannedSkill[] | null
}

function providerNameMap(snapshot: InstalledScanSnapshot): Map<string, string> {
  const map = new Map<string, string>()
  map.set(UNIVERSAL_PROVIDER_ID, 'Universal')
  for (const provider of snapshot.providers) {
    map.set(provider.id, provider.name)
  }
  for (const provider of providerRegistry.providers) {
    if (!map.has(provider.id)) {
      map.set(provider.id, provider.displayName)
    }
  }
  return map
}

/** Stable card tags such as `[Universal]` and `[Claude Code]`. */
export function providerTagsForSkill(
  skill: ScannedSkill,
  snapshot: InstalledScanSnapshot
): string[] {
  const names = providerNameMap(snapshot)
  const tags: string[] = []
  const seen = new Set<string>()

  const orderedIds = [...skill.providerIds].sort((a, b) => {
    if (a === UNIVERSAL_PROVIDER_ID) return -1
    if (b === UNIVERSAL_PROVIDER_ID) return 1
    return (names.get(a) ?? a).localeCompare(names.get(b) ?? b)
  })

  for (const id of orderedIds) {
    const label = names.get(id) ?? id
    if (seen.has(label)) continue
    seen.add(label)
    tags.push(`[${label}]`)
  }
  return tags
}

function sortSkills(skills: ScannedSkill[]): ScannedSkill[] {
  return [...skills].sort((a, b) => a.name.localeCompare(b.name))
}

function skillsForProvider(
  snapshot: InstalledScanSnapshot,
  providerId: string
): ScannedSkill[] {
  return sortSkills(
    snapshot.skills.filter(skill => skill.providerIds.includes(providerId))
  )
}

/**
 * Filter skills for the content area.
 * Non-Universal providers use direct directory associations only.
 * When `showAllUniversal` is on for a provider filter, append Universal skills
 * not already listed in the primary section.
 */
export function filterSkillsForSelection(
  snapshot: InstalledScanSnapshot,
  selection: ProviderFilterId,
  showAllUniversal: boolean
): FilteredSkillSections {
  if (selection === ALL_AGENTS_FILTER_ID) {
    return { primary: sortSkills(snapshot.skills), universalSection: null }
  }

  if (selection === UNIVERSAL_PROVIDER_ID) {
    return {
      primary: skillsForProvider(snapshot, UNIVERSAL_PROVIDER_ID),
      universalSection: null,
    }
  }

  const primary = skillsForProvider(snapshot, selection)
  if (!showAllUniversal) {
    return { primary, universalSection: null }
  }

  const primaryNames = new Set(primary.map(skill => skill.name))
  const universalSection = skillsForProvider(
    snapshot,
    UNIVERSAL_PROVIDER_ID
  ).filter(skill => !primaryNames.has(skill.name))

  return { primary, universalSection }
}

function warningsFor(
  snapshot: InstalledScanSnapshot,
  providerId: string | undefined
): ScanWarning[] {
  return snapshot.warnings.filter(warning => warning.providerId === providerId)
}

function scannedProviderItem(
  provider: ScannedProvider,
  snapshot: InstalledScanSnapshot
): ProviderSidebarItem {
  return {
    id: provider.id,
    name: provider.name,
    skillCount: provider.skillCount,
    skillsDir: provider.skillsDir,
    skillsDirExists: provider.skillsDirExists,
    active: provider.detected,
    warnings: warningsFor(snapshot, provider.id),
  }
}

/** Build sidebar rows from the scan snapshot + full registry. */
export function buildProviderSidebarModel(
  snapshot: InstalledScanSnapshot
): ProviderSidebarModel {
  const detectedIds = new Set(
    snapshot.providers.filter(p => p.detected).map(p => p.id)
  )
  const scannedById = new Map(snapshot.providers.map(p => [p.id, p]))

  const universal: ProviderSidebarItem = {
    id: UNIVERSAL_PROVIDER_ID,
    name: 'Universal',
    skillCount: snapshot.universal.skillCount,
    skillsDir: snapshot.universal.skillsDir || null,
    skillsDirExists: snapshot.universal.skillsDirExists,
    active: true,
    warnings: [
      ...warningsFor(snapshot, UNIVERSAL_PROVIDER_ID),
      ...snapshot.warnings.filter(w => w.code === 'universal_empty'),
    ],
  }

  const activeProviders = snapshot.providers
    .filter(p => p.detected && !p.universal)
    .map(p => scannedProviderItem(p, snapshot))
    .sort((a, b) => a.name.localeCompare(b.name))

  // Detected universal-registry agents (e.g. Cursor) still appear as providers.
  const detectedUniversalAgents = snapshot.providers
    .filter(p => p.detected && p.universal)
    .map(p => scannedProviderItem(p, snapshot))
    .sort((a, b) => a.name.localeCompare(b.name))

  const inactiveProviders = providerRegistry.providers
    .filter(def => !detectedIds.has(def.id))
    .map(def => {
      const scanned = scannedById.get(def.id)
      if (scanned) {
        return scannedProviderItem(scanned, snapshot)
      }
      return {
        id: def.id,
        name: def.displayName,
        skillCount: 0,
        skillsDir: null,
        skillsDirExists: false,
        active: false,
        warnings: [] as ScanWarning[],
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    allAgentsCount: snapshot.skills.length,
    universal,
    activeProviders: [...detectedUniversalAgents, ...activeProviders].sort(
      (a, b) => a.name.localeCompare(b.name)
    ),
    inactiveProviders,
  }
}

/** Content-area warnings relevant to the current selection. */
export function contentWarningsForSelection(
  snapshot: InstalledScanSnapshot,
  selection: ProviderFilterId
): ScanWarning[] {
  if (selection === ALL_AGENTS_FILTER_ID) {
    return snapshot.warnings
  }
  if (selection === UNIVERSAL_PROVIDER_ID) {
    return snapshot.warnings.filter(
      w =>
        w.code === 'universal_empty' || w.providerId === UNIVERSAL_PROVIDER_ID
    )
  }
  return snapshot.warnings.filter(w => w.providerId === selection)
}
