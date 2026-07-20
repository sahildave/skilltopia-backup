import type { PlatformPort } from './types'
import { MOCK_INSTALLED_SKILLS } from './fixtures'

export const platform: PlatformPort = {
  hasLocalLibrary: true,

  async listInstalled() {
    return MOCK_INSTALLED_SKILLS
  },

  async listProviders() {
    return [
      { id: 'claude-code', name: 'Claude Code' },
      { id: 'cursor', name: 'Cursor' },
    ]
  },

  async install(_skill, _scope) {
    // Mock install succeeds without touching disk.
  },

  async openExternal(url) {
    window.open(url, '_blank', 'noopener,noreferrer')
  },
}
