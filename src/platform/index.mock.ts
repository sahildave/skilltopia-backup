import type { InstalledScanSnapshot, PlatformPort } from './types';
import { MOCK_INSTALLED_SCAN } from './fixtures';
import { providersFromScan, skillEntriesFromScan } from './scan-utils';

let cachedScan: InstalledScanSnapshot = MOCK_INSTALLED_SCAN;

export const platform: PlatformPort = {
  hasLocalLibrary: true,
  copiesInstallCommand: false,

  async getInstalledScan() {
    return cachedScan;
  },

  async scanInstalled() {
    cachedScan = { ...MOCK_INSTALLED_SCAN, scannedAt: new Date().toISOString() };
    return cachedScan;
  },

  async listProjects() {
    return [];
  },

  async scanProject() {
    return cachedScan;
  },

  async pickCodingFolder() {
    return null;
  },

  async revealProviderSkillsDir(providerId) {
    if (providerId === 'universal') {
      return cachedScan.universal.skillsDirExists;
    }
    const provider = cachedScan.providers.find((p) => p.id === providerId);
    return provider?.skillsDirExists ?? false;
  },

  async revealPath() {
    return true;
  },

  async listInstalled() {
    return skillEntriesFromScan(cachedScan);
  },

  async listProviders() {
    return providersFromScan(cachedScan);
  },

  async install(_skill, _scope) {
    // Mock install succeeds without touching disk.
    return { results: [] };
  },

  async uninstall(_skillName, _options) {
    // Mock uninstall succeeds without touching disk.
    return { results: [] };
  },

  async copySkillToProviders(_uninstallName, providerIds) {
    return {
      results: providerIds.map((providerId) => ({
        providerId,
        status: 'copied' as const,
      })),
    };
  },

  async copyProviderSkills(_sourceProviderId, skillNames, targetProviderIds, onProgress) {
    // Synthetic ticks, one per skill, so the dialog's progress bar is
    // exercisable in the browser with no desktop backend behind it.
    skillNames.forEach((skillName, index) =>
      onProgress?.({ completed: index + 1, total: skillNames.length, skillName }),
    );
    return {
      targets: targetProviderIds.map((providerId) => ({
        providerId,
        copied: skillNames.length,
        skipped: 0,
        refused: 0,
        failed: 0,
        issues: [],
      })),
    };
  },

  async openExternal(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  },
};
