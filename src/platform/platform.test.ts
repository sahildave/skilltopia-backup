import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { platform as mockPlatform } from './index.mock';
import { platform as webPlatform } from './index.web';
import { MOCK_INSTALLED_SCAN, MOCK_INSTALLED_SKILLS } from './fixtures';
import { UNIVERSAL_PROVIDER_ID } from './types';

describe('PlatformPort mock', () => {
  it('reports a local library and returns fixture installs', async () => {
    expect(mockPlatform.hasLocalLibrary).toBe(true);
    await expect(mockPlatform.listInstalled()).resolves.toEqual(MOCK_INSTALLED_SKILLS);
  });

  it('lists mock providers from the scan snapshot', async () => {
    const providers = await mockPlatform.listProviders();
    expect(providers.length).toBeGreaterThan(0);
    expect(providers[0]).toMatchObject({ id: expect.any(String) });
  });

  it('exposes a normalized installed scan snapshot', async () => {
    const snapshot = await mockPlatform.getInstalledScan();
    expect(snapshot.skills.length).toBeGreaterThan(0);
    expect(snapshot.universal.skillCount).toBe(MOCK_INSTALLED_SCAN.universal.skillCount);
    expect(snapshot.skills.some((skill) => skill.providerIds.includes(UNIVERSAL_PROVIDER_ID))).toBe(
      true,
    );
    expect(snapshot.warnings.some((w) => w.code === 'provider_empty')).toBe(true);
  });

  it('replaces the snapshot on scanInstalled without changing fixture shape', async () => {
    const before = await mockPlatform.getInstalledScan();
    const after = await mockPlatform.scanInstalled();
    expect(after.skills).toEqual(before.skills);
    expect(after.scannedAt).not.toBe(before.scannedAt);
  });

  it('revealProviderSkillsDir reports missing dirs as false', async () => {
    await expect(mockPlatform.revealProviderSkillsDir('claude-code')).resolves.toBe(true);
    await expect(mockPlatform.revealProviderSkillsDir('missing-provider')).resolves.toBe(false);
  });

  it('revealPath succeeds in the mock', async () => {
    await expect(mockPlatform.revealPath('/tmp/project')).resolves.toBe(true);
  });

  it('accepts mocked install without throwing', async () => {
    await expect(
      mockPlatform.install(
        { id: 'vercel-labs/agent-skills/find-skills', name: 'Find Skills' },
        'global',
      ),
    ).resolves.toEqual({ results: [] });
  });

  it('accepts mocked uninstall without throwing', async () => {
    await expect(mockPlatform.uninstall('find-skills', { agentScope: 'all' })).resolves.toEqual({
      results: [],
    });
  });

  it('reports copied results for each requested provider', async () => {
    await expect(
      mockPlatform.copySkillToProviders('find-skills', ['claude-code', 'codex']),
    ).resolves.toEqual({
      results: [
        { providerId: 'claude-code', status: 'copied' },
        { providerId: 'codex', status: 'copied' },
      ],
    });
  });

  it('reports every bulk-copied skill as copied for each target', async () => {
    await expect(
      mockPlatform.copyProviderSkills('claude-code', ['a', 'b'], ['codex']),
    ).resolves.toEqual({
      targets: [{ providerId: 'codex', copied: 2, skipped: 0, refused: 0, failed: 0, issues: [] }],
    });
  });
});

describe('PlatformPort web', () => {
  beforeEach(() => {
    vi.spyOn(window, 'open').mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not import Tauri packages', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const source = readFileSync(resolve('src/platform/index.web.ts'), 'utf8');
    expect(source).not.toMatch(/@tauri-apps/);
    expect(source).not.toMatch(/__TAURI__/);
  });

  it('does not claim a local library', () => {
    expect(webPlatform.hasLocalLibrary).toBe(false);
  });

  it('returns an empty installed list and scan', async () => {
    await expect(webPlatform.listInstalled()).resolves.toEqual([]);
    const scan = await webPlatform.getInstalledScan();
    expect(scan.skills).toEqual([]);
    expect(scan.providers).toEqual([]);
  });

  it('does not reveal provider directories', async () => {
    await expect(webPlatform.revealProviderSkillsDir(UNIVERSAL_PROVIDER_ID)).resolves.toBe(false);
  });

  it('does not reveal arbitrary paths', async () => {
    await expect(webPlatform.revealPath('/tmp/project')).resolves.toBe(false);
  });

  it('copies a pasteable install command to the clipboard', async () => {
    expect(webPlatform.copiesInstallCommand).toBe(true);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await webPlatform.install(
      { id: 'vercel-labs/agent-skills/find-skills', name: 'Find Skills' },
      'global',
    );

    expect(writeText).toHaveBeenCalledWith(
      'npx --yes skills add vercel-labs/agent-skills --skill find-skills -y -g',
    );
  });

  it('copies a pasteable remove command to the clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    await webPlatform.uninstall('find-skills', { agentScope: 'all' });

    expect(writeText).toHaveBeenCalledWith(
      "npx --yes skills remove find-skills -g -y -a '*' && rm -rf ~/.agents/skills/find-skills",
    );
  });

  it('marks copySkillToProviders as unavailable on web', async () => {
    await expect(webPlatform.copySkillToProviders('find-skills', ['claude-code'])).resolves.toEqual(
      {
        results: [
          {
            providerId: 'claude-code',
            status: 'failed',
            message: 'Copy to providers requires the desktop app',
          },
        ],
      },
    );
  });

  it('marks copyProviderSkills as unavailable on web', async () => {
    await expect(
      webPlatform.copyProviderSkills('claude-code', ['find-skills'], ['codex']),
    ).resolves.toEqual({
      targets: [
        {
          providerId: 'codex',
          copied: 0,
          skipped: 0,
          refused: 0,
          failed: 1,
          issues: [
            {
              skillName: 'find-skills',
              status: 'failed',
              message: 'Copy to providers requires the desktop app',
            },
          ],
        },
      ],
    });
  });

  it('opens external urls in a new tab', async () => {
    await webPlatform.openExternal('https://skills.sh');
    expect(window.open).toHaveBeenCalledWith('https://skills.sh', '_blank', 'noopener,noreferrer');
  });
});
