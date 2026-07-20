import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  buildRegistry,
  parseAgentsSource,
} from '../../scripts/generate-provider-registry.mjs'

function stripVendoredHeader(sourceText: string): string {
  if (!sourceText.startsWith('/**')) return sourceText
  const end = sourceText.indexOf('*/')
  if (end === -1) return sourceText
  return sourceText.slice(end + 2).replace(/^\n/, '')
}

describe('provider registry generator', () => {
  it('parses a minimal agents.ts fixture into declarative probes', () => {
    const source = `
export const agents = {
  cursor: {
    name: 'cursor',
    displayName: 'Cursor',
    skillsDir: '.agents/skills',
    globalSkillsDir: join(home, '.cursor/skills'),
    detectInstalled: async () => {
      return existsSync(join(home, '.cursor'));
    },
  },
  replit: {
    name: 'replit',
    displayName: 'Replit',
    skillsDir: '.agents/skills',
    globalSkillsDir: join(configHome, 'agents/skills'),
    showInUniversalList: false,
    detectInstalled: async () => {
      return existsSync(join(process.cwd(), '.replit'));
    },
  },
};
`
    const providers = parseAgentsSource(source)
    expect(providers).toEqual([
      {
        id: 'cursor',
        displayName: 'Cursor',
        skillsDir: '.agents/skills',
        universal: true,
        showInUniversalList: true,
        showInUniversalPrompt: true,
        globalSkillsDir: {
          type: 'path',
          path: { base: 'home', path: '.cursor/skills' },
        },
        detection: {
          type: 'paths',
          match: 'any',
          paths: [{ base: 'home', path: '.cursor' }],
        },
      },
      {
        id: 'replit',
        displayName: 'Replit',
        skillsDir: '.agents/skills',
        universal: true,
        showInUniversalList: false,
        showInUniversalPrompt: true,
        globalSkillsDir: {
          type: 'path',
          path: { base: 'configHome', path: 'agents/skills' },
        },
        detection: {
          type: 'paths',
          match: 'any',
          paths: [{ base: 'cwd', path: '.replit' }],
        },
      },
    ])

    const registry = buildRegistry(providers, 'a'.repeat(40))
    expect(registry.source.repositoryUrl).toBe(
      'https://github.com/vercel-labs/skills'
    )
    expect(registry.source.commit).toHaveLength(40)
  })

  it('checked-in registry matches regenerating from the vendored upstream snapshot', () => {
    const checkedIn = JSON.parse(
      readFileSync(resolve('src/providers/registry.json'), 'utf8')
    )
    const vendored = stripVendoredHeader(
      readFileSync(resolve('src/providers/upstream/agents.ts'), 'utf8')
    )
    const regenerated = buildRegistry(
      parseAgentsSource(vendored),
      checkedIn.source.commit
    )

    expect(regenerated.providers).toEqual(checkedIn.providers)
    expect(regenerated.source.repositoryUrl).toBe(
      checkedIn.source.repositoryUrl
    )
    expect(regenerated.source.commit).toBe(checkedIn.source.commit)
    expect(regenerated.source.license).toBe('MIT')
  })
})
