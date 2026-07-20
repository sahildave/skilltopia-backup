import type { PlatformPort } from './types'

export const platform: PlatformPort = {
  hasLocalLibrary: false,

  async listInstalled() {
    return []
  },

  async listProviders() {
    return []
  },

  async install(_skill, _scope) {
    // Web copy-command UX lands in task-4.
  },

  async openExternal(url) {
    window.open(url, '_blank', 'noopener,noreferrer')
  },
}
