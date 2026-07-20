export type InstallScope = 'global' | 'project'

export interface SkillEntry {
  name: string
  isDirectory: boolean
  isFile: boolean
  isSymlink: boolean
}

export interface SkillProvider {
  id: string
  name: string
}

export interface InstallableSkill {
  id: string
  name: string
  installUrl?: string | null
}

/** Synthetic id for skills found under `~/.agents/skills`. */
export const UNIVERSAL_PROVIDER_ID = 'universal' as const

export interface ProviderRegistrySourceMeta {
  repositoryUrl: string
  commit: string
  license: string
  attribution: string
}

export type ScanWarningCode =
  | 'provider_empty'
  | 'skills_dir_missing'
  | 'entry_skipped'
  | 'universal_empty'

export interface ScanWarning {
  code: ScanWarningCode
  message: string
  providerId?: string
  path?: string
}

export interface ScannedProvider {
  id: string
  name: string
  universal: boolean
  detected: boolean
  /** Normalized global skills directory path, when resolvable. */
  skillsDir: string | null
  skillsDirExists: boolean
  /** Valid skills found in this provider's direct global skills directory. */
  skillCount: number
}

export interface ScannedSkill {
  name: string
  description: string
  scope: 'global'
  /** Provider ids plus {@link UNIVERSAL_PROVIDER_ID} when found in Universal. */
  providerIds: string[]
  /** Absolute normalized source paths (all copies after dedupe). */
  paths: string[]
}

export interface InstalledScanSnapshot {
  scannedAt: string
  source: ProviderRegistrySourceMeta
  universal: {
    skillsDir: string
    skillsDirExists: boolean
    skillCount: number
  }
  providers: ScannedProvider[]
  skills: ScannedSkill[]
  warnings: ScanWarning[]
}

export interface PlatformPort {
  hasLocalLibrary: boolean
  /** When true, `install` copies a CLI command instead of writing to disk. */
  copiesInstallCommand: boolean
  /** Return the cached snapshot, scanning once if the cache is empty. */
  getInstalledScan(): Promise<InstalledScanSnapshot>
  /** Replace the in-memory snapshot with a fresh scan. */
  scanInstalled(): Promise<InstalledScanSnapshot>
  /**
   * Reveal a provider (or Universal) skills directory in Finder/Explorer.
   * Does not rescan. Returns false when the directory is missing.
   */
  revealProviderSkillsDir(providerId: string): Promise<boolean>
  listInstalled(): Promise<SkillEntry[]>
  listProviders(): Promise<SkillProvider[]>
  install(skill: InstallableSkill, scope: InstallScope): Promise<void>
  openExternal(url: string): Promise<void>
}
