import { describe, expect, it } from 'vitest';
import { MOCK_INSTALLED_SCAN } from './fixtures';
import {
  buildSkillsAddArgs,
  buildSkillsInstallCommand,
  buildSkillsRemoveArgs,
  buildSkillsRemoveCommand,
  installAgentTargetsFromScan,
  parseSkillInstallTarget,
} from './install-command';

describe('parseSkillInstallTarget', () => {
  it('splits owner/repo/skill into source and skill name', () => {
    expect(parseSkillInstallTarget('vercel-labs/agent-skills/find-skills')).toEqual({
      source: 'vercel-labs/agent-skills',
      skillName: 'find-skills',
    });
  });

  it('rejects ids that are not owner/repo/skill', () => {
    expect(() => parseSkillInstallTarget('vercel-labs/agent-skills')).toThrow(/Invalid skill id/);
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

describe('buildSkillsAddArgs', () => {
  const skill = {
    id: 'vercel-labs/agent-skills/find-skills',
    name: 'Find Skills',
  };

  it('builds a non-interactive global universal install without -a', () => {
    expect(buildSkillsAddArgs(skill, 'global')).toEqual([
      '--yes',
      'skills',
      'add',
      'vercel-labs/agent-skills',
      '--skill',
      'find-skills',
      '-y',
      '-g',
    ]);
  });

  it('builds a non-interactive global install for detected providers', () => {
    expect(buildSkillsAddArgs(skill, 'global', { providerIds: ['claude-code'] })).toEqual([
      '--yes',
      'skills',
      'add',
      'vercel-labs/agent-skills',
      '--skill',
      'find-skills',
      '-y',
      '-a',
      'claude-code',
      '-g',
    ]);
  });

  it('builds a non-interactive project install without -g', () => {
    expect(buildSkillsAddArgs(skill, 'project', { providerIds: ['claude-code'] })).toEqual([
      '--yes',
      'skills',
      'add',
      'vercel-labs/agent-skills',
      '--skill',
      'find-skills',
      '-y',
      '-a',
      'claude-code',
    ]);
  });
});

describe('buildSkillsRemoveArgs', () => {
  it('builds a non-interactive global remove for all agents', () => {
    expect(buildSkillsRemoveArgs('find-skills', { agentScope: 'all' })).toEqual([
      '--yes',
      'skills',
      'remove',
      'find-skills',
      '-g',
      '-y',
      '-a',
      '*',
    ]);
  });

  it('builds a non-interactive global remove for all agents using providerIds', () => {
    expect(
      buildSkillsRemoveArgs('find-skills', {
        agentScope: 'all',
        providerIds: ['claude-code', 'cursor'],
      }),
    ).toEqual([
      '--yes',
      'skills',
      'remove',
      'find-skills',
      '-g',
      '-y',
      '-a',
      'claude-code',
      '-a',
      'cursor',
    ]);
  });

  it('excludes the synthetic universal provider from all-agent remove args', () => {
    expect(
      buildSkillsRemoveArgs('find-skills', {
        agentScope: 'all',
        providerIds: ['universal', 'claude-code'],
      }),
    ).toEqual(['--yes', 'skills', 'remove', 'find-skills', '-g', '-y', '-a', 'claude-code']);
  });

  it('builds a non-interactive global remove for one provider', () => {
    expect(
      buildSkillsRemoveArgs('find-skills', {
        agentScope: { providerId: 'claude-code' },
      }),
    ).toEqual(['--yes', 'skills', 'remove', 'find-skills', '-g', '-y', '-a', 'claude-code']);
  });

  it('builds a non-interactive universal remove without -a', () => {
    expect(buildSkillsRemoveArgs('find-skills', { agentScope: 'universal' })).toEqual([
      '--yes',
      'skills',
      'remove',
      'find-skills',
      '-g',
      '-y',
    ]);
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
