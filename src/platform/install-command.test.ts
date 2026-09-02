import { describe, expect, it } from 'vitest';
import { MOCK_INSTALLED_SCAN } from './fixtures';
import {
  buildSkillsInstallCommand,
  buildSkillsRemoveCommand,
  installAgentTargetsFromScan,
  parseSkillInstallTarget,
  uninstallTargetIds,
  UnsupportedSkillSourceError,
} from './install-command';
import { providerRegistry } from '@/providers';

describe('parseSkillInstallTarget', () => {
  it('splits owner/repo/skill into source and skill name', () => {
    expect(parseSkillInstallTarget('vercel-labs/agent-skills/find-skills')).toEqual({
      source: 'vercel-labs/agent-skills',
      skillName: 'find-skills',
    });
  });

  it('rejects ids that are not owner/repo/skill', () => {
    expect(() => parseSkillInstallTarget('find-skills')).toThrow(/Invalid skill id/);
  });

  it('names the host when a skill is published from a website, not a repository', () => {
    expect(() => parseSkillInstallTarget('uizze.com/anti-ui-slop')).toThrow(
      UnsupportedSkillSourceError,
    );
    expect(() => parseSkillInstallTarget('uizze.com/anti-ui-slop')).toThrow(/uizze\.com/);
  });
});

describe('installAgentTargetsFromScan', () => {
  it('includes detected non-universal providers with a global skills dir', () => {
    expect(installAgentTargetsFromScan(MOCK_INSTALLED_SCAN)).toEqual({
      providerIds: ['claude-code'],
    });
  });

  it('returns an empty list when no providers qualify', () => {
    expect(
      installAgentTargetsFromScan({
        ...MOCK_INSTALLED_SCAN,
        providers: [
          {
            id: 'cursor',
            name: 'Cursor',
            universal: true,
            detected: true,
            skillsDir: '/Users/mock/.cursor/skills',
            skillsDirExists: true,
            skillCount: 0,
          },
        ],
      }),
    ).toEqual({ providerIds: [] });
  });
});

describe('uninstallTargetIds', () => {
  it('appends the universal cleanup after the providers', () => {
    expect(
      uninstallTargetIds({ agentScope: 'all', providerIds: ['claude-code', 'cursor'] }),
    ).toEqual(['claude-code', 'cursor', 'universal']);
  });

  it('drops the synthetic provider ids that own no skills directory', () => {
    expect(
      uninstallTargetIds({
        agentScope: 'all',
        providerIds: ['universal', 'project-agents', 'claude-code'],
      }),
    ).toEqual(['claude-code', 'universal']);
  });

  it('fans out over the whole registry when no provider list is known', () => {
    const targets = uninstallTargetIds({ agentScope: 'all' });
    expect(targets.length).toBe(providerRegistry.providers.length);
    expect(targets.at(-1)).toBe('universal');
  });

  it('targets one provider without the universal cleanup', () => {
    expect(uninstallTargetIds({ agentScope: { providerId: 'codex' } })).toEqual(['codex']);
  });

  it('targets universal alone', () => {
    expect(uninstallTargetIds({ agentScope: 'universal' })).toEqual(['universal']);
  });
});

describe('buildSkillsRemoveCommand', () => {
  it('formats a pasteable npx all-agents remove command', () => {
    expect(buildSkillsRemoveCommand('find-skills', { agentScope: 'all' })).toBe(
      "npx --yes skills remove find-skills -g -y -a '*' && rm -rf ~/.agents/skills/find-skills",
    );
  });

  it('formats a pasteable npx all-agents remove command chaining multiple providerIds', () => {
    expect(
      buildSkillsRemoveCommand('find-skills', {
        agentScope: 'all',
        providerIds: ['claude-code', 'cursor'],
      }),
    ).toBe(
      'npx --yes skills remove find-skills -g -y -a claude-code && npx --yes skills remove find-skills -g -y -a cursor && rm -rf ~/.agents/skills/find-skills',
    );
  });

  it('formats all-agents remove with real providers plus universal cleanup', () => {
    expect(
      buildSkillsRemoveCommand('find-skills', {
        agentScope: 'all',
        providerIds: ['universal', 'claude-code'],
      }),
    ).toBe(
      'npx --yes skills remove find-skills -g -y -a claude-code && rm -rf ~/.agents/skills/find-skills',
    );
  });

  it('formats a pasteable npx provider remove command', () => {
    expect(
      buildSkillsRemoveCommand('find-skills', {
        agentScope: { providerId: 'claude-code' },
      }),
    ).toBe('npx --yes skills remove find-skills -g -y -a claude-code');
  });

  it('formats a pasteable npx universal remove command', () => {
    expect(buildSkillsRemoveCommand('find-skills', { agentScope: 'universal' })).toBe(
      'npx --yes skills remove find-skills -g -y',
    );
  });
});

describe('buildSkillsInstallCommand', () => {
  const skill = {
    id: 'vercel-labs/agent-skills/find-skills',
    name: 'Find Skills',
  };

  it('formats a pasteable npx global universal install command', () => {
    expect(buildSkillsInstallCommand(skill, 'global')).toBe(
      'npx --yes skills add vercel-labs/agent-skills --skill find-skills -y -g',
    );
  });

  it('formats a pasteable npx project install command', () => {
    expect(buildSkillsInstallCommand(skill, 'project')).toBe(
      'npx --yes skills add vercel-labs/agent-skills --skill find-skills -y',
    );
  });
});
