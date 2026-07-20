import { describe, expect, it } from 'vitest'
import {
  buildSkillsAddArgs,
  buildSkillsInstallCommand,
  buildSkillsRemoveArgs,
  buildSkillsRemoveCommand,
  parseSkillInstallTarget,
} from './install-command'

describe('parseSkillInstallTarget', () => {
  it('splits owner/repo/skill into source and skill name', () => {
    expect(
      parseSkillInstallTarget('vercel-labs/agent-skills/find-skills')
    ).toEqual({
      source: 'vercel-labs/agent-skills',
      skillName: 'find-skills',
    })
  })

  it('rejects ids that are not owner/repo/skill', () => {
    expect(() => parseSkillInstallTarget('vercel-labs/agent-skills')).toThrow(
      /Invalid skill id/
    )
  })
})

describe('buildSkillsAddArgs', () => {
  const skill = {
    id: 'vercel-labs/agent-skills/find-skills',
    name: 'Find Skills',
  }

  it('builds a non-interactive global install for all agents', () => {
    expect(buildSkillsAddArgs(skill, 'global')).toEqual([
      '--yes',
      'skills',
      'add',
      'vercel-labs/agent-skills',
      '--skill',
      'find-skills',
      '-y',
      '-a',
      '*',
      '-g',
    ])
  })

  it('builds a non-interactive project install without -g', () => {
    expect(buildSkillsAddArgs(skill, 'project')).toEqual([
      '--yes',
      'skills',
      'add',
      'vercel-labs/agent-skills',
      '--skill',
      'find-skills',
      '-y',
      '-a',
      '*',
    ])
  })
})

describe('buildSkillsRemoveArgs', () => {
  it('builds a non-interactive global remove for all agents', () => {
    expect(buildSkillsRemoveArgs('find-skills', 'all')).toEqual([
      '--yes',
      'skills',
      'remove',
      'find-skills',
      '-g',
      '-y',
      '-a',
      '*',
    ])
  })

  it('builds a non-interactive global remove for one provider', () => {
    expect(
      buildSkillsRemoveArgs('find-skills', { providerId: 'claude-code' })
    ).toEqual([
      '--yes',
      'skills',
      'remove',
      'find-skills',
      '-g',
      '-y',
      '-a',
      'claude-code',
    ])
  })

  it('builds a non-interactive universal remove without -a', () => {
    expect(buildSkillsRemoveArgs('find-skills', 'universal')).toEqual([
      '--yes',
      'skills',
      'remove',
      'find-skills',
      '-g',
      '-y',
    ])
  })
})

describe('buildSkillsRemoveCommand', () => {
  it('formats a pasteable npx all-agents remove command', () => {
    expect(buildSkillsRemoveCommand('find-skills', 'all')).toBe(
      "npx --yes skills remove find-skills -g -y -a '*'"
    )
  })

  it('formats a pasteable npx provider remove command', () => {
    expect(
      buildSkillsRemoveCommand('find-skills', { providerId: 'claude-code' })
    ).toBe('npx --yes skills remove find-skills -g -y -a claude-code')
  })

  it('formats a pasteable npx universal remove command', () => {
    expect(buildSkillsRemoveCommand('find-skills', 'universal')).toBe(
      'npx --yes skills remove find-skills -g -y'
    )
  })
})

describe('buildSkillsInstallCommand', () => {
  const skill = {
    id: 'vercel-labs/agent-skills/find-skills',
    name: 'Find Skills',
  }

  it('formats a pasteable npx global install command', () => {
    expect(buildSkillsInstallCommand(skill, 'global')).toBe(
      "npx --yes skills add vercel-labs/agent-skills --skill find-skills -y -a '*' -g"
    )
  })

  it('formats a pasteable npx project install command', () => {
    expect(buildSkillsInstallCommand(skill, 'project')).toBe(
      "npx --yes skills add vercel-labs/agent-skills --skill find-skills -y -a '*'"
    )
  })
})
