// Skill provenance is declared once in Rust (`provider_scan::types::SkillOrigin`)
// and reaches TypeScript through `npm run rust:bindings`. Re-exported here so
// shared UI keeps importing only from `@platform`.
import type { SkillOrigin } from '@/lib/bindings';

export type { SkillOrigin };

export type InstallScope = 'global' | 'project';

export interface SkillEntry {
  name: string;
  isDirectory: boolean;
  isFile: boolean;
  isSymlink: boolean;
}

export interface SkillProvider {
  id: string;
  name: string;
}

export interface InstallableSkill {
  id: string;
  name: string;
  installUrl?: string | null;
}

/** Synthetic id for skills found under `~/.agents/skills`. */
export const UNIVERSAL_PROVIDER_ID = 'universal' as const;

/** Synthetic id for skills found under `<project>/.agents/skills` (not Universal). */
export const PROJECT_AGENTS_PROVIDER_ID = 'project-agents' as const;

export interface ProviderRegistrySourceMeta {
  repositoryUrl: string;
  commit: string;
  license: string;
  attribution: string;
}

export type ScanWarningCode =
  | 'provider_empty'
  | 'skills_dir_missing'
  | 'entry_skipped'
  | 'universal_empty';

export interface ScanWarning {
  code: ScanWarningCode;
  message: string;
  providerId?: string;
  path?: string;
}

export interface ScannedProvider {
  id: string;
  name: string;
  universal: boolean;
  detected: boolean;
  /** Normalized global skills directory path, when resolvable. */
  skillsDir: string | null;
  skillsDirExists: boolean;
  /** Valid skills found in this provider's direct global skills directory. */
  skillCount: number;
}

export interface ScannedSkillPath {
  path: string;
  /** Resolved target when `path` is a symlink to the skill directory. */
  originalPath?: string;
}

export interface ScannedSkill {
  name: string;
  /** Folder slug passed to `skills remove`, distinct from display name. */
  uninstallName: string;
  description: string;
  scope: InstallScope;
  /** Provider ids plus {@link UNIVERSAL_PROVIDER_ID} or {@link PROJECT_AGENTS_PROVIDER_ID}. */
  providerIds: string[];
  /** Where this skill came from; a skill can have more than one origin. */
  origins: SkillOrigin[];
  /** Source paths (all copies after dedupe). */
  paths: ScannedSkillPath[];
}

export interface InstalledScanSnapshot {
  scannedAt: string;
  source: ProviderRegistrySourceMeta;
  universal: {
    skillsDir: string;
    skillsDirExists: boolean;
    skillCount: number;
  };
  providers: ScannedProvider[];
  skills: ScannedSkill[];
  warnings: ScanWarning[];
}

export interface ProjectInfo {
  name: string;
  path: string;
  depth: number;
  skillCount: number;
}

/** Agent scope for `skills remove` (maps from Installed Skills sidebar filter). */
export type UninstallAgentScope = 'all' | 'universal' | { providerId: string };

export interface UninstallOptions {
  agentScope: UninstallAgentScope;
  providerIds?: string[];
}

/** Outcome of projecting one skill into (or out of) one target. */
export type SkillTargetStatus =
  | 'written'
  | 'already_present'
  | 'conflict'
  | 'removed'
  | 'absent'
  /** The destination is inside the read-only Claude plugin cache. */
  | 'refused'
  | 'failed';

export interface SkillTargetResult {
  providerId: string;
  status: SkillTargetStatus;
  message?: string;
}

export interface SkillTargetsResult {
  results: SkillTargetResult[];
  /**
   * The folder a project-scoped install landed in. Absent for global installs.
   * Nothing else can report it: the user picks it in a native dialog, and the
   * home-root scan never walks it.
   */
  projectPath?: string;
}

export type CopyProviderStatus =
  | 'copied'
  | 'conflict'
  /** The destination is inside the read-only Claude plugin cache. */
  | 'refused'
  | 'failed';

export interface CopyProviderResult {
  providerId: string;
  status: CopyProviderStatus;
  message?: string;
}

export interface CopySkillToProvidersResult {
  results: CopyProviderResult[];
}

export type BulkCopyStatus =
  | 'copied'
  /** Already present at the destination; left untouched. */
  | 'skipped'
  /** The destination is inside the read-only Claude plugin cache. */
  | 'refused'
  | 'failed';

/** One skill that did not copy, named so the summary can say which. */
export interface BulkCopyIssue {
  skillName: string;
  status: BulkCopyStatus;
  message?: string;
}

export interface BulkCopyTargetResult {
  providerId: string;
  copied: number;
  skipped: number;
  refused: number;
  failed: number;
  /** Failures only; skipped and refused are counted, not enumerated. */
  issues: BulkCopyIssue[];
}

export interface CopyProviderSkillsResult {
  targets: BulkCopyTargetResult[];
}

/**
 * One tick of a bulk copy: emitted after a skill has been handled for every
 * selected target, so `completed` advances once per name, not per write.
 */
export interface BulkCopyProgress {
  completed: number;
  total: number;
  skillName: string;
}

export interface PlatformPort {
  hasLocalLibrary: boolean;
  /** When true, `install` copies a CLI command instead of writing to disk. */
  copiesInstallCommand: boolean;
  /** Return the cached snapshot, scanning once if the cache is empty. */
  getInstalledScan(): Promise<InstalledScanSnapshot>;
  /** Replace the in-memory snapshot with a fresh scan. */
  scanInstalled(): Promise<InstalledScanSnapshot>;
  listProjects(root: string): Promise<ProjectInfo[]>;
  scanProject(projectPath: string): Promise<InstalledScanSnapshot>;
  pickCodingFolder(): Promise<string | null>;
  /**
   * Reveal a provider (or Universal) skills directory in Finder/Explorer.
   * Does not rescan. Returns false when the directory is missing.
   */
  revealProviderSkillsDir(providerId: string): Promise<boolean>;
  /**
   * Reveal an arbitrary path in Finder/Explorer.
   * Does not rescan. Returns false when the path is missing.
   */
  revealPath(path: string): Promise<boolean>;
  listInstalled(): Promise<SkillEntry[]>;
  listProviders(): Promise<SkillProvider[]>;
  /**
   * Install one skill. Returns independent per-target outcomes so the caller can
   * report partial success; only a whole-operation failure rejects.
   */
  install(skill: InstallableSkill, scope: InstallScope): Promise<SkillTargetsResult>;
  /** Uninstall one skill. Per-target outcomes as with {@link install}. */
  uninstall(skillName: string, options: UninstallOptions): Promise<SkillTargetsResult>;
  /**
   * Symlink one installed skill into each selected provider skills folder.
   * Returns independent per-provider outcomes; does not rescan.
   */
  copySkillToProviders(
    uninstallName: string,
    providerIds: string[],
  ): Promise<CopySkillToProvidersResult>;
  /**
   * Copy every named skill owned by `sourceProviderId` into each target
   * provider. Sources come from that provider's own skills directory, so a
   * Universal copy of the same name never stands in for it. Names already at a
   * destination are left untouched and counted as skipped. Does not rescan.
   * `onProgress` receives one tick per skill; a port with no backend to report
   * from may never call it.
   */
  copyProviderSkills(
    sourceProviderId: string,
    skillNames: string[],
    targetProviderIds: string[],
    onProgress?: (progress: BulkCopyProgress) => void,
  ): Promise<CopyProviderSkillsResult>;
  openExternal(url: string): Promise<void>;
}
