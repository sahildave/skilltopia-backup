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

export interface PlatformPort {
  hasLocalLibrary: boolean
  /** When true, `install` copies a CLI command instead of writing to disk. */
  copiesInstallCommand: boolean
  listInstalled(): Promise<SkillEntry[]>
  listProviders(): Promise<SkillProvider[]>
  install(skill: InstallableSkill, scope: InstallScope): Promise<void>
  openExternal(url: string): Promise<void>
}
