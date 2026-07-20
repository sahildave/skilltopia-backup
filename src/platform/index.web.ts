import { buildSkillsInstallCommand } from './install-command'
import type { PlatformPort } from './types'

export const platform: PlatformPort = {
  hasLocalLibrary: false,
  copiesInstallCommand: true,

  async listInstalled() {
    return []
  },

  async listProviders() {
    return []
  },

  async install(skill, scope) {
    const command = buildSkillsInstallCommand(skill, scope)
    await navigator.clipboard.writeText(command)
  },

  async openExternal(url) {
    window.open(url, '_blank', 'noopener,noreferrer')
  },
}
