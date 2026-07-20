import { homeDir, join } from '@tauri-apps/api/path'
import { exists, readDir } from '@tauri-apps/plugin-fs'
import { openUrl } from '@tauri-apps/plugin-opener'
import type { SkillEntry } from './types'
import type { PlatformPort } from './types'

async function listInstalledFromDisk(): Promise<SkillEntry[]> {
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

export const platform: PlatformPort = {
  hasLocalLibrary: true,

  listInstalled: listInstalledFromDisk,

  async listProviders() {
    return [
      { id: 'claude-code', name: 'Claude Code' },
      { id: 'cursor', name: 'Cursor' },
      { id: 'codex', name: 'Codex' },
    ]
  },

  async install(_skill, _scope) {
    // Desktop install body lands in task-5.
  },

  async openExternal(url) {
    await openUrl(url)
  },
}
