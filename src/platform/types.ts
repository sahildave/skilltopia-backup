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
  scope: 'global';
  /** Provider ids plus {@link UNIVERSAL_PROVIDER_ID} when found in Universal. */
  providerIds: string[];
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

/** Agent scope for `skills remove` (maps from Installed Skills sidebar filter). */
export type UninstallAgentScope = 'all' | 'universal' | { providerId: string };

export interface UninstallOptions {
  agentScope: UninstallAgentScope;
  providerIds?: string[];
}

export type CopyProviderStatus = 'copied' | 'conflict' | 'failed';

export interface CopyProviderResult {
  providerId: string;
  status: CopyProviderStatus;
  message?: string;
}

export interface CopySkillToProvidersResult {
  results: CopyProviderResult[];
}

export interface PlatformPort {
  hasLocalLibrary: boolean;
  /** When true, `install` copies a CLI command instead of writing to disk. */
  copiesInstallCommand: boolean;
  /** Return the cached snapshot, scanning once if the cache is empty. */
  getInstalledScan(): Promise<InstalledScanSnapshot>;
  /** Replace the in-memory snapshot with a fresh scan. */
  scanInstalled(): Promise<InstalledScanSnapshot>;
  /**
   * Reveal a provider (or Universal) skills directory in Finder/Explorer.
   * Does not rescan. Returns false when the directory is missing.
   */
  revealProviderSkillsDir(providerId: string): Promise<boolean>;
  listInstalled(): Promise<SkillEntry[]>;
  listProviders(): Promise<SkillProvider[]>;
  install(skill: InstallableSkill, scope: InstallScope): Promise<void>;
  uninstall(skillName: string, options: UninstallOptions): Promise<void>;
  /**
   * Symlink one installed skill into each selected provider skills folder.
   * Returns independent per-provider outcomes; does not rescan.
   */
  copySkillToProviders(
    uninstallName: string,
    providerIds: string[],
  ): Promise<CopySkillToProvidersResult>;
  openExternal(url: string): Promise<void>;
}
