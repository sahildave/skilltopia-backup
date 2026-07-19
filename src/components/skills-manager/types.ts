export type SkillsNavId = 'library' | 'dashboard' | 'install' | 'presets'

export interface SkillEntry {
  name: string
  isDirectory: boolean
  isFile: boolean
  isSymlink: boolean
}
