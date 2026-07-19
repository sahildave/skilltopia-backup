import { homeDir, join } from '@tauri-apps/api/path'
import { exists, readDir } from '@tauri-apps/plugin-fs'
import type { SkillEntry } from './types'

export async function readGlobalSkills(): Promise<SkillEntry[]> {
  const home = await homeDir()
  const skillsPath = await join(home, '.agents', 'skills')

  const folderExists = await exists(skillsPath)
  if (!folderExists) {
    throw new Error(`Path not found: ${skillsPath}`)
  }

  const entries = await readDir(skillsPath)

  return entries
    .map(entry => ({
      name: entry.name,
      isDirectory: entry.isDirectory,
      isFile: entry.isFile,
      isSymlink: entry.isSymlink,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export function isPermissionError(message: string): boolean {
  const lower = message.toLowerCase()
  return (
    lower.includes('forbidden') ||
    lower.includes('not allowed') ||
    lower.includes('denied') ||
    lower.includes('scope') ||
    lower.includes('permission')
  )
}
