import type {
  InstalledScanSnapshot,
  ScannedProvider,
  ScannedSkill,
  ScanWarning,
  ScanWarningCode,
  UninstallAgentScope,
} from '@/platform/types';
import { PROJECT_AGENTS_PROVIDER_ID, UNIVERSAL_PROVIDER_ID } from '@/platform/types';
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
  /** Skills for the current filter. */
  primary: ScannedSkill[];
}

function providerNameMap(snapshot: InstalledScanSnapshot): Map<string, string> {
  const map = new Map<string, string>();
  map.set(UNIVERSAL_PROVIDER_ID, 'Universal');
  map.set(PROJECT_AGENTS_PROVIDER_ID, 'Project');
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
  | { kind: 'project' }
  | { kind: 'location'; label: string }
  /** Shipped by a Claude plugin, which owns it — read-only to this app. */
  | { kind: 'plugin'; plugin: string; marketplace: string; version: string }
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

function isSyntheticSkillsDirId(id: string): boolean {
  return id === UNIVERSAL_PROVIDER_ID || id === PROJECT_AGENTS_PROVIDER_ID;
}

/** Counted non-synthetic provider names for badge display (distinct skills dirs only). */
function countedProviderNames(skill: ScannedSkill, snapshot: InstalledScanSnapshot): string[] {
  const names = providerNameMap(snapshot);
  const universalSkillsDir = snapshot.universal.skillsDir;
  const scannedById = new Map(snapshot.providers.map((p) => [p.id, p]));
  const labels: string[] = [];
  const seen = new Set<string>();

  const orderedIds = skill.providerIds
    .filter((id) => !isSyntheticSkillsDirId(id))
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

/** `.claude/skills` → `.claude`; `agent/skills` → `agent`. */
export function projectSkillsDirBadgeLabel(skillsDir: string): string {
  const normalized = skillsDir.replaceAll('\\', '/').replace(/\/+$/, '');
  const withoutSkills = normalized.replace(/\/skills$/, '');
  const segment = withoutSkills.split('/').pop() ?? withoutSkills;
  if (segment.startsWith('.')) return segment;
  return segment;
}

function pathUnderDir(path: string, dir: string): boolean {
  const normalizedPath = path.replaceAll('\\', '/');
  const normalizedDir = dir.replaceAll('\\', '/').replace(/\/+$/, '');
  return normalizedPath === normalizedDir || normalizedPath.startsWith(`${normalizedDir}/`);
}

/**
 * Project-scoped badges use filesystem locations, never global provider identity.
 * `.agents/skills` → Project; other project skills dirs → short folder labels (`.claude`).
 */
function projectLocationBadges(
  skill: ScannedSkill,
  snapshot: InstalledScanSnapshot,
): SkillProviderBadge[] {
  const badges: SkillProviderBadge[] = [];
  const agentsDir = snapshot.universal.skillsDir;
  const hasAgentsPath =
    Boolean(agentsDir) && skill.paths.some((entry) => pathUnderDir(entry.path, agentsDir));
  if (hasAgentsPath || skill.providerIds.includes(PROJECT_AGENTS_PROVIDER_ID)) {
    badges.push({ kind: 'project' });
  }

  const locationLabels = new Set<string>();
  for (const provider of snapshot.providers) {
    const skillsDir = provider.skillsDir;
    if (!skillsDir || (agentsDir && skillsDir === agentsDir)) continue;
    const inProviderDir = skill.paths.some((entry) => pathUnderDir(entry.path, skillsDir));
    if (!inProviderDir) continue;
    locationLabels.add(projectSkillsDirBadgeLabel(skillsDir));
  }

  for (const label of [...locationLabels].sort((a, b) => a.localeCompare(b))) {
    badges.push({ kind: 'location', label });
  }
  return badges;
}

function pluginBadges(skill: ScannedSkill): SkillProviderBadge[] {
  return pluginOriginsForSkill(skill).map((origin) => ({ kind: 'plugin' as const, ...origin }));
}

/**
 * Card/list badges:
 * - Global: optional `Universal`, plus aggregated `n Providers`
 * - Project: `Project` for `.agents/skills`, plus short folder labels (`.claude`) —
 *   never Universal or global provider counts
 * - Either scope: one badge per plugin that ships the skill, last, so the
 *   origin the user cannot change reads as an annotation on the rest.
 */
export function providerBadgesForSkill(
  skill: ScannedSkill,
  snapshot: InstalledScanSnapshot,
): SkillProviderBadge[] {
  if (skill.scope === 'project') {
    return [...projectLocationBadges(skill, snapshot), ...pluginBadges(skill)];
  }

  const badges: SkillProviderBadge[] = [];
  if (skill.providerIds.includes(UNIVERSAL_PROVIDER_ID)) {
    badges.push({ kind: 'universal' });
  }
  const names = countedProviderNames(skill, snapshot);
  if (names.length > 0) {
    badges.push({ kind: 'providers', count: names.length, names });
  }
  return [...badges, ...pluginBadges(skill)];
}

/** Plugin origins, deduped by plugin + marketplace and sorted for stable badges. */
export function pluginOriginsForSkill(
  skill: ScannedSkill,
): { plugin: string; marketplace: string; version: string }[] {
  const byKey = new Map<string, { plugin: string; marketplace: string; version: string }>();
  for (const origin of skill.origins) {
    if (origin.kind !== 'claudePlugin') continue;
    const key = `${origin.plugin}@${origin.marketplace}`;
    if (!byKey.has(key)) {
      byKey.set(key, {
        plugin: origin.plugin,
        marketplace: origin.marketplace,
        version: origin.version,
      });
    }
  }
  return [...byKey.values()].sort((a, b) => a.plugin.localeCompare(b.plugin));
}

/**
 * True when a plugin is the *only* reason this skill is here. The plugin cache
 * is read-only, so there is nothing for an uninstall to remove — Rust refuses
 * it, and the UI should not offer it. A skill that also sits in a directory the
 * user owns is still uninstallable from there.
 */
export function isPluginManagedSkill(skill: ScannedSkill): boolean {
  return (
    skill.origins.length > 0 && skill.origins.every((origin) => origin.kind === 'claudePlugin')
  );
}

/** `<plugin>@<marketplace>`, or the bare plugin name when unknown. */
export function pluginOriginLabel(origin: { plugin: string; marketplace: string }): string {
  return origin.marketplace ? `${origin.plugin}@${origin.marketplace}` : origin.plugin;
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
  const installedIds = new Set(
    skill.providerIds.filter(
      (id) => id !== UNIVERSAL_PROVIDER_ID && id !== PROJECT_AGENTS_PROVIDER_ID,
    ),
  );
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

export interface BulkCopyTargetOption extends CopyProviderOption {
  /** Source skills this target does not have yet. */
  toCopy: number;
  /** Source skills whose name is already present at this target. */
  alreadyThere: number;
}

export interface BulkCopyDialogModel {
  /** Folder names to copy, in the order the dialog reports them. */
  skillNames: string[];
  targets: BulkCopyTargetOption[];
}

/**
 * Skills the provider physically owns: a real, non-symlinked directory under
 * its own skills folder. The same rule the toolbar's "Provider" view applies,
 * and the only correct source set for a bulk copy — a symlinked entry is
 * another provider's (or Universal's) content projected in, not this one's.
 */
export function ownedSkillsForProvider(
  snapshot: InstalledScanSnapshot,
  providerId: string,
): ScannedSkill[] {
  const skillsDir = snapshot.providers.find((p) => p.id === providerId)?.skillsDir;
  if (!skillsDir || skillsDir === snapshot.universal.skillsDir) return [];

  return sortSkills(
    snapshot.skills.filter((skill) =>
      skill.paths.some((entry) => !entry.originalPath && pathUnderDir(entry.path, skillsDir)),
    ),
  );
}

/**
 * Destination rows for the bulk copy dialog, counted from the snapshot alone —
 * no extra scan and no backend preview call. "Already there" is a name match at
 * the destination, which is exactly what the backend skips.
 */
export function buildBulkCopyDialogModel(
  snapshot: InstalledScanSnapshot,
  sourceProviderId: string,
): BulkCopyDialogModel {
  const sourceSkills = ownedSkillsForProvider(snapshot, sourceProviderId);
  const skillNames = sourceSkills.map((skill) => skill.uninstallName);
  const sidebar = buildProviderSidebarModel(snapshot);

  const targets = [...sidebar.activeProviders, ...sidebar.inactiveProviders]
    .filter((item) => item.id !== sourceProviderId && isEligibleCopyDestination(item, snapshot))
    .map((item) => {
      const present = new Set(
        ownedSkillsForProvider(snapshot, String(item.id)).map((skill) => skill.uninstallName),
      );
      const alreadyThere = skillNames.filter((name) => present.has(name)).length;
      return {
        ...toCopyOption(item),
        toCopy: skillNames.length - alreadyThere,
        alreadyThere,
      };
    })
    .sort((a, b) => b.toCopy - a.toCopy || a.name.localeCompare(b.name));

  return { skillNames, targets };
}

function sortSkills(skills: ScannedSkill[]): ScannedSkill[] {
  return [...skills].sort((a, b) => a.name.localeCompare(b.name));
}

function skillsForProvider(snapshot: InstalledScanSnapshot, providerId: string): ScannedSkill[] {
  return sortSkills(snapshot.skills.filter((skill) => skill.providerIds.includes(providerId)));
}

function isUniversalRegistryProvider(snapshot: InstalledScanSnapshot, providerId: string): boolean {
  return snapshot.providers.some((provider) => provider.id === providerId && provider.universal);
}

/**
 * Skills a sidebar selection can invoke.
 * Universal-registry agents (Codex, Cursor, …) also load `~/.agents/skills`.
 * Non-universal agents only see their direct directory associations.
 */
export function filterSkillsForSelection(
  snapshot: InstalledScanSnapshot,
  selection: ProviderFilterId,
): FilteredSkillSections {
  if (selection === ALL_AGENTS_FILTER_ID) {
    return { primary: sortSkills(snapshot.skills) };
  }

  if (selection === UNIVERSAL_PROVIDER_ID) {
    return { primary: skillsForProvider(snapshot, UNIVERSAL_PROVIDER_ID) };
  }

  if (isUniversalRegistryProvider(snapshot, selection)) {
    return {
      primary: sortSkills(
        snapshot.skills.filter(
          (skill) =>
            skill.providerIds.includes(selection) ||
            skill.providerIds.includes(UNIVERSAL_PROVIDER_ID),
        ),
      ),
    };
  }

  return { primary: skillsForProvider(snapshot, selection) };
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
  };
}

/**
 * Apply the Installed Skills toolbar view after provider/sidebar filtering.
 * Provider = real folders in a provider-specific directory, plus skills a
 * plugin ships (a real folder in the plugin's own tree, no provider id).
 * Available = Universal skills and/or provider entries that resolve through a
 * symlink (shared slash commands an agent can use).
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

    if (skill.origins.some((origin) => origin.kind === 'claudePlugin')) return true;

    return skill.paths.some(
      (entry) =>
        !entry.originalPath &&
        !entry.path.startsWith(universalDir) &&
        skill.providerIds.some((providerId) => providerId !== UNIVERSAL_PROVIDER_ID),
    );
  };

  return {
    primary: sections.primary.filter(matches),
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

/** Count skills a provider row can invoke (Universal agents include Universal). */
function providerInvocableSkillCount(
  provider: ScannedProvider,
  snapshot: InstalledScanSnapshot,
): number {
  if (provider.universal && hasDistinctSkillsDir(provider, snapshot.universal.skillsDir)) {
    return snapshot.skills.filter(
      (skill) =>
        skill.providerIds.includes(provider.id) ||
        skill.providerIds.includes(UNIVERSAL_PROVIDER_ID),
    ).length;
  }
  return provider.skillCount;
}

function scannedProviderItem(
  provider: ScannedProvider,
  snapshot: InstalledScanSnapshot,
  inActiveList: boolean,
): ProviderSidebarItem {
  return {
    id: provider.id,
    name: provider.name,
    skillCount: providerInvocableSkillCount(provider, snapshot),
    skillsDir: provider.skillsDir,
    skillsDirExists: provider.skillsDirExists,
    active: inActiveList,
    warnings: warningsFor(snapshot, provider.id),
  };
}

function providerHasListableSkills(
  provider: ScannedProvider,
  snapshot: InstalledScanSnapshot,
): boolean {
  return providerInvocableSkillCount(provider, snapshot) > 0;
}

/** Build sidebar rows from the scan snapshot + full registry. */
export function buildProviderSidebarModel(snapshot: InstalledScanSnapshot): ProviderSidebarModel {
  const universalSkillsDir = snapshot.universal.skillsDir;
  const filledProviderIds = new Set(
    snapshot.providers
      .filter((p) => p.detected && providerHasListableSkills(p, snapshot))
      .map((p) => p.id),
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
        providerHasListableSkills(p, snapshot) &&
        hasDistinctSkillsDir(p, universalSkillsDir),
    )
    .map((p) => scannedProviderItem(p, snapshot, true))
    .sort(sortProvidersByCountThenName);

  // Detected universal-registry agents with their own dir (e.g. Codex) still appear.
  // Counts include Universal skills those agents can invoke without a local copy.
  const detectedUniversalAgents = snapshot.providers
    .filter(
      (p) =>
        p.detected &&
        p.universal &&
        providerHasListableSkills(p, snapshot) &&
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
