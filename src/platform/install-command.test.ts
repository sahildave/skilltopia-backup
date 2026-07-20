import { describe, expect, it } from 'vitest'
import {
  buildSkillsAddArgs,
  buildSkillsInstallCommand,
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
