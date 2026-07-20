import { describe, expect, it } from 'vitest'
import {
  ALL_AGENTS_FILTER_ID,
  buildProviderSidebarModel,
  contentWarningsForSelection,
  filterSkillsForSelection,
  providerTagsForSkill,
} from './installed-skills-model'
import {
  MOCK_EMPTY_SCAN,
  MOCK_INSTALLED_SCAN,
  MOCK_PROVIDER_ONLY_SCAN,
  MOCK_UNIVERSAL_ONLY_SCAN,
} from '@/platform/fixtures'
import { UNIVERSAL_PROVIDER_ID } from '@/platform/types'

describe('filterSkillsForSelection', () => {
  it('returns all skills alphabetically for All Agents', () => {
    const { primary, universalSection } = filterSkillsForSelection(
      MOCK_INSTALLED_SCAN,
      ALL_AGENTS_FILTER_ID,
      false
    )
    expect(universalSection).toBeNull()
    expect(primary.map(s => s.name)).toEqual([
      'code-review',
      'find-skills',
      'frontend-design',
    ])
  })

  it('returns only Universal-associated skills for Universal', () => {
    const { primary } = filterSkillsForSelection(
      MOCK_UNIVERSAL_ONLY_SCAN,
      UNIVERSAL_PROVIDER_ID,
      false
    )
    expect(primary.map(s => s.name)).toEqual(['frontend-design'])
  })

  it('returns only direct provider skills for a non-Universal provider', () => {
    const { primary, universalSection } = filterSkillsForSelection(
      MOCK_PROVIDER_ONLY_SCAN,
      'claude-code',
      false
    )
    expect(universalSection).toBeNull()
    expect(primary.map(s => s.name)).toEqual(['code-review'])
  })

  it('keeps same-name skills as one card with merged provider tags', () => {
    const skill = MOCK_INSTALLED_SCAN.skills.find(s => s.name === 'find-skills')
    expect(skill?.providerIds).toEqual([UNIVERSAL_PROVIDER_ID, 'claude-code'])
    expect(skill?.paths.length).toBe(2)
  })

  it('appends Universal skills not already listed when Show all Universal is on', () => {
    const { primary, universalSection } = filterSkillsForSelection(
      MOCK_INSTALLED_SCAN,
      'claude-code',
      true
    )
    expect(primary.map(s => s.name)).toEqual(['code-review', 'find-skills'])
    expect(universalSection?.map(s => s.name)).toEqual(['frontend-design'])
  })
})

describe('providerTagsForSkill', () => {
  it('builds stable provider tags with Universal first', () => {
    const skill = MOCK_INSTALLED_SCAN.skills.find(s => s.name === 'find-skills')
    expect(skill).toBeDefined()
    if (!skill) return
    expect(providerTagsForSkill(skill, MOCK_INSTALLED_SCAN)).toEqual([
      '[Universal]',
      '[Claude Code]',
    ])
  })
})

describe('buildProviderSidebarModel', () => {
  it('keeps Universal visible and lists active then inactive providers', () => {
    const model = buildProviderSidebarModel(MOCK_INSTALLED_SCAN)
    expect(model.universal.skillCount).toBe(2)
    expect(model.universal.skillsDir).toBe('/Users/mock/.agents/skills')
    expect(model.allAgentsCount).toBe(3)
    expect(model.activeProviders.map(p => p.id)).toEqual([
      'claude-code',
      'cursor',
    ])
    expect(
      model.activeProviders.find(p => p.id === 'cursor')?.warnings
    ).toHaveLength(1)
    expect(model.inactiveProviders.length).toBeGreaterThan(0)
    expect(model.inactiveProviders.every(p => !p.active)).toBe(true)
    expect(model.inactiveProviders.some(p => p.id === 'claude-code')).toBe(
      false
    )
  })

  it('keeps Universal visible when the scan is empty', () => {
    const model = buildProviderSidebarModel(MOCK_EMPTY_SCAN)
    expect(model.universal.skillCount).toBe(0)
    expect(model.allAgentsCount).toBe(0)
    expect(model.universal.skillsDirExists).toBe(false)
  })
})

describe('contentWarningsForSelection', () => {
  it('scopes warnings to the selected provider', () => {
    expect(
      contentWarningsForSelection(MOCK_INSTALLED_SCAN, 'cursor')
    ).toHaveLength(1)
    expect(
      contentWarningsForSelection(MOCK_INSTALLED_SCAN, 'claude-code')
    ).toHaveLength(0)
    expect(
      contentWarningsForSelection(MOCK_INSTALLED_SCAN, ALL_AGENTS_FILTER_ID)
    ).toHaveLength(1)
  })

  it('surfaces empty-scan warnings for Universal and All Agents', () => {
    expect(
      contentWarningsForSelection(MOCK_EMPTY_SCAN, UNIVERSAL_PROVIDER_ID)
    ).toHaveLength(1)
    expect(
      contentWarningsForSelection(MOCK_EMPTY_SCAN, ALL_AGENTS_FILTER_ID)
    ).toHaveLength(2)
  })
})
