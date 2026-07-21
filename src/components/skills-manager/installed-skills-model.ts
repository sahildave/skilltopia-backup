import type {
  InstalledScanSnapshot,
  ScannedProvider,
  ScannedSkill,
  ScanWarning,
  ScanWarningCode,
  UninstallAgentScope,
} from '@/platform/types';
import { UNIVERSAL_PROVIDER_ID } from '@/platform/types';
import { getProviderById, providerRegistry } from '@/providers';

/** Session selection for the Installed Skills provider filter. */
export type ProviderFilterId = 'all' | typeof UNIVERSAL_PROVIDER_ID | string;

export type InstalledSkillView = 'all' | 'provider' | 'available';

export const ALL_AGENTS_FILTER_ID = 'all' as const;

export interface ProviderSidebarItem {
  id: ProviderFilterId;
  name: string;
  skillCount: number;
  skillsDir: string | null;
  skillsDirExists: boolean;
  /** True when this row is Universal or a detected provider. */
  active: boolean;
  warnings: ScanWarning[];
}

export interface ProviderSidebarModel {
  allAgentsCount: number;
  universal: ProviderSidebarItem;
  activeProviders: ProviderSidebarItem[];
  inactiveProviders: ProviderSidebarItem[];
}

export interface FilteredSkillSections {
  /** Primary list for the current filter. */
  primary: ScannedSkill[];
  /** Optional Universal Skills section (Show all Universal). */
  universalSection: ScannedSkill[] | null;
}

function providerNameMap(snapshot: InstalledScanSnapshot): Map<string, string> {
  const map = new Map<string, string>();
  map.set(UNIVERSAL_PROVIDER_ID, 'Universal');
  for (const provider of snapshot.providers) {
    map.set(provider.id, provider.name);
  }
  for (const provider of providerRegistry.providers) {
    if (!map.has(provider.id)) {
      map.set(provider.id, provider.displayName);
    }
  }
  return map;
}

export type SkillProviderBadge =
  | { kind: 'universal' }
  | { kind: 'providers'; count: number; names: string[] };

export interface CopyProviderOption {
  id: string;
  name: string;
}

export interface CopyProviderDialogModel {
  available: CopyProviderOption[];
  installed: CopyProviderOption[];
  other: CopyProviderOption[];
}

function providerSharesUniversalDir(
  provider: ScannedProvider,
  universalSkillsDir: string,
): boolean {
  return (
    provider.skillsDir != null &&
    provider.skillsDir !== '' &&
    provider.skillsDir === universalSkillsDir
  );
}

/** Counted non-Universal provider names for badge display (distinct skills dirs only). */
function countedProviderNames(skill: ScannedSkill, snapshot: InstalledScanSnapshot): string[] {
  const names = providerNameMap(snapshot);
  const universalSkillsDir = snapshot.universal.skillsDir;
  const scannedById = new Map(snapshot.providers.map((p) => [p.id, p]));
  const labels: string[] = [];
  const seen = new Set<string>();

  const orderedIds = skill.providerIds
    .filter((id) => id !== UNIVERSAL_PROVIDER_ID)
    .sort((a, b) => (names.get(a) ?? a).localeCompare(names.get(b) ?? b));

  for (const id of orderedIds) {
    const scanned = scannedById.get(id);
    if (scanned && providerSharesUniversalDir(scanned, universalSkillsDir)) {
      continue;
    }
    const label = names.get(id) ?? id;
    if (seen.has(label)) continue;
    seen.add(label);
    labels.push(label);
  }
  return labels;
}

/**
 * Card/list badges: optional `Universal`, plus aggregated `n Providers`.
 * Providers that share the Universal skills directory are excluded from the count.
 */
export function providerBadgesForSkill(
  skill: ScannedSkill,
  snapshot: InstalledScanSnapshot,
): SkillProviderBadge[] {
  const badges: SkillProviderBadge[] = [];
  if (skill.providerIds.includes(UNIVERSAL_PROVIDER_ID)) {
    badges.push({ kind: 'universal' });
  }
  const names = countedProviderNames(skill, snapshot);
  if (names.length > 0) {
    badges.push({ kind: 'providers', count: names.length, names });
  }
  return badges;
}

function toCopyOption(item: ProviderSidebarItem): CopyProviderOption {
  return { id: String(item.id), name: item.name };
}

function isEligibleCopyDestination(
  item: ProviderSidebarItem,
  snapshot: InstalledScanSnapshot,
): boolean {
  if (item.id === UNIVERSAL_PROVIDER_ID) return false;
  const skillsDir = item.skillsDir;
  if (skillsDir && skillsDir === snapshot.universal.skillsDir) return false;

  // Unscanned inactive rows have a null skillsDir — exclude registry agents whose
  // global skills path is the Universal ~/.agents/skills tree.
  if (!skillsDir) {
    const def = getProviderById(providerRegistry, String(item.id));
    const globalPath = def?.globalSkillsDir;
    if (globalPath?.type === 'path') {
      const raw = globalPath.path.path;
      if (raw) {
        const normalized = raw.replaceAll('\\', '/');
        if (normalized === '.agents/skills' || normalized === 'agents/skills') {
          return false;
        }
      }
    }
  }

  return true;
}

/**
 * Provider-selection sections for the copy dialog.
 * Universal is never listed. Universal-directory-sharing providers are not
 * copy destinations (Available / Other) but still appear under Already installed
 * when the skill is associated with them.
 */
export function buildCopyProviderDialogModel(
  skill: ScannedSkill,
  snapshot: InstalledScanSnapshot,
): CopyProviderDialogModel {
  const sidebar = buildProviderSidebarModel(snapshot);
  const installedIds = new Set(skill.providerIds.filter((id) => id !== UNIVERSAL_PROVIDER_ID));
  const names = providerNameMap(snapshot);

  const available = sidebar.activeProviders
    .filter((p) => isEligibleCopyDestination(p, snapshot) && !installedIds.has(p.id))
    .map(toCopyOption);

  const installedFromSidebar = [...sidebar.activeProviders, ...sidebar.inactiveProviders]
    .filter((p) => p.id !== UNIVERSAL_PROVIDER_ID && installedIds.has(p.id))
    .map(toCopyOption);

  const listedInstalled = new Set(installedFromSidebar.map((p) => p.id));
  const installedExtra = [...installedIds]
    .filter((id) => !listedInstalled.has(id))
    .map((id) => ({ id, name: names.get(id) ?? id }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const other = sidebar.inactiveProviders
    .filter((p) => isEligibleCopyDestination(p, snapshot) && !installedIds.has(p.id))
    .map(toCopyOption);

  return {
    available,
    installed: [...installedFromSidebar, ...installedExtra].sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    other,
  };
}

function sortSkills(skills: ScannedSkill[]): ScannedSkill[] {
  return [...skills].sort((a, b) => a.name.localeCompare(b.name));
}

function skillsForProvider(snapshot: InstalledScanSnapshot, providerId: string): ScannedSkill[] {
  return sortSkills(snapshot.skills.filter((skill) => skill.providerIds.includes(providerId)));
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
  showAllUniversal: boolean,
): FilteredSkillSections {
  if (selection === ALL_AGENTS_FILTER_ID) {
    return { primary: sortSkills(snapshot.skills), universalSection: null };
  }

  if (selection === UNIVERSAL_PROVIDER_ID) {
    return {
      primary: skillsForProvider(snapshot, UNIVERSAL_PROVIDER_ID),
      universalSection: null,
    };
  }

  const primary = skillsForProvider(snapshot, selection);
  if (!showAllUniversal) {
    return { primary, universalSection: null };
  }

  const primaryNames = new Set(primary.map((skill) => skill.name));
  const universalSection = skillsForProvider(snapshot, UNIVERSAL_PROVIDER_ID).filter(
    (skill) => !primaryNames.has(skill.name),
  );

  return { primary, universalSection };
}

/** Case-insensitive local filter over name and catalog repo (`source`) when known. */
export function filterSkillSectionsByQuery(
  sections: FilteredSkillSections,
  query: string,
  catalogSourcesByKey: ReadonlyMap<string, string> = new Map(),
): FilteredSkillSections {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return sections;
  }

  const matches = (skill: ScannedSkill) => {
    if (skill.name.toLowerCase().includes(normalized)) {
      return true;
    }
    const source =
      catalogSourcesByKey.get(skill.uninstallName) ?? catalogSourcesByKey.get(skill.name);
    return source?.toLowerCase().includes(normalized) ?? false;
  };

  return {
    primary: sections.primary.filter(matches),
    universalSection: sections.universalSection ? sections.universalSection.filter(matches) : null,
  };
}

/**
 * Apply the Installed Skills toolbar view after provider/sidebar filtering.
 * Provider means a real, provider-specific directory with no Universal copy;
 * Available means a Universal skill or a provider entry that resolves through
 * a symlink.
 */
export function filterSkillSectionsByView(
  sections: FilteredSkillSections,
  snapshot: InstalledScanSnapshot,
  view: InstalledSkillView,
): FilteredSkillSections {
  if (view === 'all') return sections;

  const universalDir = snapshot.universal.skillsDir;
  const matches = (skill: ScannedSkill) => {
    const hasUniversalPath = skill.providerIds.includes(UNIVERSAL_PROVIDER_ID);
    const hasSymlink = skill.paths.some((entry) => Boolean(entry.originalPath));
    if (view === 'available') return hasUniversalPath || hasSymlink;

    return (
      !hasUniversalPath &&
      skill.paths.some(
        (entry) =>
          !entry.originalPath &&
          !entry.path.startsWith(universalDir) &&
          skill.providerIds.some((providerId) => providerId !== UNIVERSAL_PROVIDER_ID),
      )
    );
  };

  return {
    primary: sections.primary.filter(matches),
    universalSection: sections.universalSection ? sections.universalSection.filter(matches) : null,
  };
}

function warningsFor(
  snapshot: InstalledScanSnapshot,
  providerId: string | undefined,
): ScanWarning[] {
  return snapshot.warnings.filter((warning) => warning.providerId === providerId);
}

/** Benign when a provider is detected but has no valid global skills. */
const SIDEBAR_SUPPRESSED_WARNING_CODES = new Set<ScanWarningCode>(['provider_empty']);

function skillsDirForSelection(
  snapshot: InstalledScanSnapshot,
  selection: ProviderFilterId,
): string | null {
  if (selection === UNIVERSAL_PROVIDER_ID) {
    return snapshot.universal.skillsDir || null;
  }
  const provider = snapshot.providers.find((p) => p.id === selection);
  return provider?.skillsDir ?? null;
}

/** Resolved symlink target for the current filter, when applicable. */
export function symlinkOriginalForSelection(
  skill: ScannedSkill,
  snapshot: InstalledScanSnapshot,
  selection: ProviderFilterId,
): string | null {
  const skillsDir =
    selection === ALL_AGENTS_FILTER_ID ? null : skillsDirForSelection(snapshot, selection);

  for (const entry of skill.paths) {
    if (!entry.originalPath) continue;
    if (selection === ALL_AGENTS_FILTER_ID) {
      return entry.originalPath;
    }
    if (skillsDir && entry.path.startsWith(skillsDir)) {
      return entry.originalPath;
    }
  }

  return null;
}

/** Warnings that warrant a content-area banner. */
export function isBannerWarning(warning: ScanWarning, selection: ProviderFilterId): boolean {
  if (SIDEBAR_SUPPRESSED_WARNING_CODES.has(warning.code)) {
    return false;
  }
  if (warning.code === 'entry_skipped' && selection === ALL_AGENTS_FILTER_ID) {
    return false;
  }
  return true;
}

/** Provider id for `revealProviderSkillsDir`, when the warning maps to a skills folder. */
export function warningRevealProviderId(warning: ScanWarning): string | null {
  if (warning.code === 'universal_empty') {
    return UNIVERSAL_PROVIDER_ID;
  }
  return warning.providerId ?? null;
}

export function sidebarWarnings(warnings: ScanWarning[]): ScanWarning[] {
  return warnings.filter((w) => !SIDEBAR_SUPPRESSED_WARNING_CODES.has(w.code));
}

function sortProvidersByCountThenName(a: ProviderSidebarItem, b: ProviderSidebarItem): number {
  return b.skillCount - a.skillCount || a.name.localeCompare(b.name);
}

function scannedProviderItem(
  provider: ScannedProvider,
  snapshot: InstalledScanSnapshot,
  inActiveList: boolean,
): ProviderSidebarItem {
  return {
    id: provider.id,
    name: provider.name,
    skillCount: provider.skillCount,
    skillsDir: provider.skillsDir,
    skillsDirExists: provider.skillsDirExists,
    active: inActiveList,
    warnings: warningsFor(snapshot, provider.id),
  };
}

function providerHasDirectSkills(provider: ScannedProvider): boolean {
  return provider.skillCount > 0;
}

/**
 * True when the provider owns a skills directory distinct from Universal.
 * Agents like Cline share `~/.agents/skills` and must not get a sidebar row.
 */
function hasDistinctSkillsDir(provider: ScannedProvider, universalSkillsDir: string): boolean {
  return (
    provider.skillsDir != null &&
    provider.skillsDir !== '' &&
    provider.skillsDir !== universalSkillsDir
  );
}

/** Build sidebar rows from the scan snapshot + full registry. */
export function buildProviderSidebarModel(snapshot: InstalledScanSnapshot): ProviderSidebarModel {
  const universalSkillsDir = snapshot.universal.skillsDir;
  const filledProviderIds = new Set(
    snapshot.providers.filter((p) => p.detected && providerHasDirectSkills(p)).map((p) => p.id),
  );
  const scannedById = new Map(snapshot.providers.map((p) => [p.id, p]));

  const universal: ProviderSidebarItem = {
    id: UNIVERSAL_PROVIDER_ID,
    name: 'Universal',
    skillCount: snapshot.universal.skillCount,
    skillsDir: snapshot.universal.skillsDir || null,
    skillsDirExists: snapshot.universal.skillsDirExists,
    active: true,
    warnings: [
      ...warningsFor(snapshot, UNIVERSAL_PROVIDER_ID),
      ...snapshot.warnings.filter((w) => w.code === 'universal_empty'),
    ],
  };

  const activeProviders = snapshot.providers
    .filter(
      (p) =>
        p.detected &&
        !p.universal &&
        providerHasDirectSkills(p) &&
        hasDistinctSkillsDir(p, universalSkillsDir),
    )
    .map((p) => scannedProviderItem(p, snapshot, true))
    .sort(sortProvidersByCountThenName);

  // Detected universal-registry agents with their own dir (e.g. Cursor) still appear.
  const detectedUniversalAgents = snapshot.providers
    .filter(
      (p) =>
        p.detected &&
        p.universal &&
        providerHasDirectSkills(p) &&
        hasDistinctSkillsDir(p, universalSkillsDir),
    )
    .map((p) => scannedProviderItem(p, snapshot, true))
    .sort(sortProvidersByCountThenName);

  const inactiveProviders = providerRegistry.providers
    .filter((def) => !filledProviderIds.has(def.id))
    .map((def) => {
      const scanned = scannedById.get(def.id);
      if (scanned) {
        return scannedProviderItem(scanned, snapshot, false);
      }
      return {
        id: def.id,
        name: def.displayName,
        skillCount: 0,
        skillsDir: null,
        skillsDirExists: false,
        active: false,
        warnings: [] as ScanWarning[],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    allAgentsCount: snapshot.skills.length,
    universal,
    activeProviders: [...detectedUniversalAgents, ...activeProviders].sort(
      sortProvidersByCountThenName,
    ),
    inactiveProviders,
  };
}

/** Content-area warnings relevant to the current selection. */
export function contentWarningsForSelection(
  snapshot: InstalledScanSnapshot,
  selection: ProviderFilterId,
): ScanWarning[] {
  let warnings: ScanWarning[];
  if (selection === ALL_AGENTS_FILTER_ID) {
    warnings = snapshot.warnings;
  } else if (selection === UNIVERSAL_PROVIDER_ID) {
    warnings = snapshot.warnings.filter(
      (w) => w.code === 'universal_empty' || w.providerId === UNIVERSAL_PROVIDER_ID,
    );
  } else {
    warnings = snapshot.warnings.filter((w) => w.providerId === selection);
  }
  return warnings.filter((w) => isBannerWarning(w, selection));
}

export function uninstallAgentScopeFromFilter(filter: ProviderFilterId): UninstallAgentScope {
  if (filter === ALL_AGENTS_FILTER_ID) return 'all';
  if (filter === UNIVERSAL_PROVIDER_ID) return 'universal';
  return { providerId: filter };
}
