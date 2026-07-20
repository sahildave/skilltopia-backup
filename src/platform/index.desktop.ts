import { open } from '@tauri-apps/plugin-dialog'
import { homeDir, join } from '@tauri-apps/api/path'
import { exists, readDir } from '@tauri-apps/plugin-fs'
import { openUrl } from '@tauri-apps/plugin-opener'
import { Command } from '@tauri-apps/plugin-shell'
import i18n from '@/i18n/config'
import { buildSkillsAddArgs, InstallCancelledError } from './install-command'
import type {
  InstallableSkill,
  InstallScope,
  PlatformPort,
  SkillEntry,
} from './types'

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

async function pickProjectDirectory(): Promise<string> {
  const selected = await open({
    directory: true,
    multiple: false,
    title: i18n.t('skills.install.pickProject'),
  })

  if (typeof selected !== 'string' || selected.length === 0) {
    throw new InstallCancelledError('No project folder selected')
  }

  return selected
}

async function installSkillToDisk(
  skill: InstallableSkill,
  scope: InstallScope
): Promise<void> {
  const cwd = scope === 'project' ? await pickProjectDirectory() : undefined
  const args = buildSkillsAddArgs(skill, scope)
  const output = await Command.create(
    'npx',
    args,
    cwd ? { cwd } : undefined
  ).execute()

  if (output.code !== 0) {
    const detail = [output.stderr, output.stdout]
      .map(part => part.trim())
      .filter(Boolean)
      .join('\n')
    throw new Error(
      detail ||
        `Skill install failed (exit ${String(output.code ?? 'unknown')})`
    )
  }
}

export const platform: PlatformPort = {
  hasLocalLibrary: true,
  copiesInstallCommand: false,

  listInstalled: listInstalledFromDisk,

  async listProviders() {
    return [
      { id: 'claude-code', name: 'Claude Code' },
      { id: 'cursor', name: 'Cursor' },
      { id: 'codex', name: 'Codex' },
    ]
  },

  install: installSkillToDisk,

  async openExternal(url) {
    await openUrl(url)
  },
}
