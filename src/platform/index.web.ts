import { buildSkillsInstallCommand, buildSkillsRemoveCommand } from './install-command';
import { EMPTY_INSTALLED_SCAN } from './scan-utils';
import type { PlatformPort } from './types';

export const platform: PlatformPort = {
  hasLocalLibrary: false,
  copiesInstallCommand: true,

  async getInstalledScan() {
    return EMPTY_INSTALLED_SCAN;
  },

  async scanInstalled() {
    return EMPTY_INSTALLED_SCAN;
  },

  async revealProviderSkillsDir() {
    return false;
  },

  async listInstalled() {
    return [];
  },

  async listProviders() {
    return [];
  },

  async install(skill, scope) {
    const command = buildSkillsInstallCommand(skill, scope);
    await navigator.clipboard.writeText(command);
  },

  async uninstall(skillName, options) {
    const command = buildSkillsRemoveCommand(skillName, options);
    await navigator.clipboard.writeText(command);
  },

  async openExternal(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  },
};
