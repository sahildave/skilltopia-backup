import { describe, expect, it } from 'vitest'
import {
  ALL_AGENTS_FILTER_ID,
  buildProviderSidebarModel,
  contentWarningsForSelection,
  filterSkillsForSelection,
  providerTagsForSkill,
  warningRevealProviderId,
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
      'Universal',
      'Claude Code',
    ])
  })
})

describe('buildProviderSidebarModel', () => {
  it('keeps Universal visible and lists filled providers in the active group', () => {
    const model = buildProviderSidebarModel(MOCK_INSTALLED_SCAN)
    expect(model.universal.skillCount).toBe(2)
    expect(model.universal.skillsDir).toBe('/Users/mock/.agents/skills')
    expect(model.allAgentsCount).toBe(3)
    expect(model.activeProviders.map(p => p.id)).toEqual(['claude-code'])
    expect(model.inactiveProviders.some(p => p.id === 'cursor')).toBe(true)
    expect(model.inactiveProviders.length).toBeGreaterThan(0)
    expect(model.inactiveProviders.every(p => !p.active)).toBe(true)
    expect(model.inactiveProviders.some(p => p.id === 'claude-code')).toBe(
      false
    )
  })

  it('sorts active providers by skill count descending, then name', () => {
    const snapshot: typeof MOCK_INSTALLED_SCAN = {
      ...MOCK_INSTALLED_SCAN,
      providers: [
        {
          id: 'cursor',
          name: 'Cursor',
          universal: true,
          detected: true,
          skillsDir: '/Users/mock/.cursor/skills',
          skillsDirExists: true,
          skillCount: 1,
        },
        {
          id: 'claude-code',
          name: 'Claude Code',
          universal: false,
          detected: true,
          skillsDir: '/Users/mock/.claude/skills',
          skillsDirExists: true,
          skillCount: 3,
        },
        {
          id: 'amp',
          name: 'Amp',
          universal: false,
          detected: true,
          skillsDir: '/Users/mock/.config/amp/skills',
          skillsDirExists: true,
          skillCount: 3,
        },
      ],
    }
    const model = buildProviderSidebarModel(snapshot)
    expect(model.activeProviders.map(p => p.id)).toEqual([
      'amp',
      'claude-code',
      'cursor',
    ])
  })

  it('keeps Universal visible when the scan is empty', () => {
    const model = buildProviderSidebarModel(MOCK_EMPTY_SCAN)
    expect(model.universal.skillCount).toBe(0)
    expect(model.allAgentsCount).toBe(0)
    expect(model.universal.skillsDirExists).toBe(false)
  })
})

describe('contentWarningsForSelection', () => {
  it('omits benign provider_empty warnings from banners', () => {
    expect(
      contentWarningsForSelection(MOCK_INSTALLED_SCAN, 'cursor')
    ).toHaveLength(0)
    expect(
      contentWarningsForSelection(MOCK_INSTALLED_SCAN, ALL_AGENTS_FILTER_ID)
    ).toHaveLength(0)
    expect(
      contentWarningsForSelection(MOCK_INSTALLED_SCAN, 'claude-code')
    ).toHaveLength(0)
  })

  it('surfaces missing-directory and empty-universal warnings for banners', () => {
    expect(
      contentWarningsForSelection(MOCK_EMPTY_SCAN, UNIVERSAL_PROVIDER_ID)
    ).toHaveLength(1)
    expect(
      contentWarningsForSelection(MOCK_EMPTY_SCAN, ALL_AGENTS_FILTER_ID)
    ).toHaveLength(2)
    expect(
      contentWarningsForSelection(MOCK_EMPTY_SCAN, 'claude-code')
    ).toHaveLength(1)
  })

  it('maps banner warnings to reveal provider ids', () => {
    const universalWarning = MOCK_EMPTY_SCAN.warnings.find(
      w => w.code === 'universal_empty'
    )
    expect(universalWarning).toBeDefined()
    if (!universalWarning) return
    expect(warningRevealProviderId(universalWarning)).toBe(
      UNIVERSAL_PROVIDER_ID
    )

    const missingDir = MOCK_EMPTY_SCAN.warnings.find(
      w => w.code === 'skills_dir_missing'
    )
    expect(missingDir).toBeDefined()
    if (!missingDir) return
    expect(warningRevealProviderId(missingDir)).toBe('claude-code')
  })
})
