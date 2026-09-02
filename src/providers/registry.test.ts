import { describe, expect, it } from 'vitest';
import {
  getNonUniversalProviders,
  getProviderById,
  getUniversalProviders,
  getVisibleUniversalProviders,
  isUniversalProvider,
  PROVIDER_REGISTRY_SOURCE_URL,
  providerRegistry,
  universalSkillsDirRelative,
} from './index';
import { createProbeContext, resolveGlobalSkillsDir } from './evaluate-detection';

describe('provider registry source metadata', () => {
  it('records the canonical vercel-labs/skills URL, commit, and MIT attribution', () => {
    expect(providerRegistry.source.repositoryUrl).toBe(PROVIDER_REGISTRY_SOURCE_URL);
    expect(PROVIDER_REGISTRY_SOURCE_URL).toBe('https://github.com/vercel-labs/skills');
    expect(providerRegistry.source.commit).toMatch(/^[a-f0-9]{40}$/);
    expect(providerRegistry.source.license).toBe('MIT');
    expect(providerRegistry.source.attribution).toMatch(/MIT/);
    expect(providerRegistry.source.agentsTsPath).toBe('src/agents.ts');
  });
});

describe('Universal classification parity', () => {
  it('marks Universal when skillsDir is .agents/skills', () => {
    const cursor = getProviderById(providerRegistry, 'cursor');
    expect(cursor).toBeDefined();
    expect(cursor?.skillsDir).toBe('.agents/skills');
    expect(cursor && isUniversalProvider(cursor)).toBe(true);

    const claude = getProviderById(providerRegistry, 'claude-code');
    expect(claude?.skillsDir).toBe('.claude/skills');
    expect(claude && isUniversalProvider(claude)).toBe(false);
  });

  it('matches upstream getUniversalAgents (excludes showInUniversalList: false)', () => {
    expect(getUniversalProviders(providerRegistry).map((p) => p.id)).toEqual([
      'amp',
      'antigravity',
      'antigravity-cli',
      'cline',
      'codex',
      'cursor',
      'deepagents',
      'dexto',
      'firebender',
      'gemini-cli',
      'github-copilot',
      'kimi-code-cli',
      'loaf',
      'opencode',
      'promptscript',
      'warp',
      'zed',
    ]);
  });

  it('matches upstream getVisibleUniversalAgents', () => {
    expect(getVisibleUniversalProviders(providerRegistry).map((p) => p.id)).toEqual([
      'amp',
      'antigravity',
      'antigravity-cli',
      'cline',
      'codex',
      'cursor',
      'deepagents',
      'gemini-cli',
      'github-copilot',
      'kimi-code-cli',
      'opencode',
      'warp',
      'zed',
    ]);
  });

  it('matches upstream getNonUniversalAgents', () => {
    const nonUniversal = getNonUniversalProviders(providerRegistry);
    expect(nonUniversal.every((p) => p.skillsDir !== '.agents/skills')).toBe(true);
    expect(nonUniversal.some((p) => p.id === 'claude-code')).toBe(true);
    expect(nonUniversal.some((p) => p.id === 'cursor')).toBe(false);
  });

  it('keeps replit and universal out of the Universal list via visibility flags', () => {
    const replit = getProviderById(providerRegistry, 'replit');
    const universal = getProviderById(providerRegistry, 'universal');
    expect(replit?.universal).toBe(true);
    expect(replit?.showInUniversalList).toBe(false);
    expect(universal?.universal).toBe(true);
    expect(universal?.showInUniversalList).toBe(false);
    expect(getUniversalProviders(providerRegistry).some((p) => p.id === 'replit')).toBe(false);
  });
});

describe('canonical Universal skills directory', () => {
  const HOME = '/Users/mock';
  /** Providers whose globalSkillsDir must resolve to the Universal root. */
  const SHARING_PROVIDERS = ['cline', 'dexto', 'kimi-code-cli', 'loaf', 'warp', 'zed'];

  it('derives the Universal root from the universal provider skillsDir', () => {
    expect(universalSkillsDirRelative(providerRegistry)).toBe('.agents/skills');
  });

  it('agrees with every provider that shares the Universal tree', () => {
    const universalDir = `${HOME}/${universalSkillsDirRelative(providerRegistry)}`;
    for (const id of SHARING_PROVIDERS) {
      const provider = getProviderById(providerRegistry, id);
      if (!provider) throw new Error(`${id} missing from registry`);
      expect(
        resolveGlobalSkillsDir(
          provider.globalSkillsDir,
          createProbeContext({ home: HOME, cwd: HOME, platform: 'darwin', env: {} }),
        ),
        `${id} no longer resolves to the Universal skills dir`,
      ).toBe(universalDir);
    }
  });
});
