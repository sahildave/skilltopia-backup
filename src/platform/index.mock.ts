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

  async revealProviderSkillsDir(providerId) {
    if (providerId === 'universal') {
      return cachedScan.universal.skillsDirExists;
    }
    const provider = cachedScan.providers.find((p) => p.id === providerId);
    return provider?.skillsDirExists ?? false;
  },

  async listInstalled() {
    return skillEntriesFromScan(cachedScan);
  },

  async listProviders() {
    return providersFromScan(cachedScan);
  },

  async install(_skill, _scope) {
    // Mock install succeeds without touching disk.
  },

  async uninstall(_skillName, _options) {
    // Mock uninstall succeeds without touching disk.
  },

  async copySkillToProviders(_uninstallName, providerIds) {
    return {
      results: providerIds.map((providerId) => ({
        providerId,
        status: 'copied' as const,
      })),
    };
  },

  async openExternal(url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  },
};
