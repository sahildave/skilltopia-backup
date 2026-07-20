import type { InstalledScanSnapshot } from './types'
import { UNIVERSAL_PROVIDER_ID } from './types'
import { skillEntriesFromScan } from './scan-utils'

/** Default mock snapshot: Universal + provider overlap, empty detected provider. */
export const MOCK_INSTALLED_SCAN: InstalledScanSnapshot = {
  scannedAt: '2026-07-20T00:00:00.000Z',
  source: {
    repositoryUrl: 'https://github.com/vercel-labs/skills',
    commit: 'fixture',
    license: 'MIT',
    attribution:
      'Provider definitions derived from vercel-labs/skills (MIT). Fixture snapshot for mock TARGET.',
  },
  universal: {
    skillsDir: '/Users/mock/.agents/skills',
    skillsDirExists: true,
    skillCount: 2,
  },
  providers: [
    {
      id: 'claude-code',
      name: 'Claude Code',
      universal: false,
      detected: true,
      skillsDir: '/Users/mock/.claude/skills',
      skillsDirExists: true,
      skillCount: 2,
    },
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
  skills: [
    {
      name: 'find-skills',
      description: 'Find and install agent skills',
      scope: 'global',
      providerIds: [UNIVERSAL_PROVIDER_ID, 'claude-code'],
      paths: [
        { path: '/Users/mock/.agents/skills/find-skills' },
        { path: '/Users/mock/.claude/skills/find-skills' },
      ],
    },
    {
      name: 'frontend-design',
      description: 'Create distinctive frontend interfaces',
      scope: 'global',
      providerIds: [UNIVERSAL_PROVIDER_ID],
      paths: [{ path: '/Users/mock/.agents/skills/frontend-design' }],
    },
    {
      name: 'code-review',
      description: 'Review code for quality issues',
      scope: 'global',
      providerIds: ['claude-code'],
      paths: [{ path: '/Users/mock/.claude/skills/code-review' }],
    },
  ],
  warnings: [
    {
      code: 'provider_empty',
      message: 'Cursor is detected but has no valid global skills',
      providerId: 'cursor',
      path: '/Users/mock/.cursor/skills',
    },
  ],
}

/** Universal-only skills (no provider-direct copies). */
export const MOCK_UNIVERSAL_ONLY_SCAN: InstalledScanSnapshot = {
  ...MOCK_INSTALLED_SCAN,
  scannedAt: '2026-07-20T00:01:00.000Z',
  providers: [],
  universal: {
    skillsDir: '/Users/mock/.agents/skills',
    skillsDirExists: true,
    skillCount: 1,
  },
  skills: [
    {
      name: 'frontend-design',
      description: 'Create distinctive frontend interfaces',
      scope: 'global',
      providerIds: [UNIVERSAL_PROVIDER_ID],
      paths: [{ path: '/Users/mock/.agents/skills/frontend-design' }],
    },
  ],
  warnings: [],
}

/** Provider-direct skills only (no Universal copies). */
export const MOCK_PROVIDER_ONLY_SCAN: InstalledScanSnapshot = {
  ...MOCK_INSTALLED_SCAN,
  scannedAt: '2026-07-20T00:02:00.000Z',
  universal: {
    skillsDir: '/Users/mock/.agents/skills',
    skillsDirExists: true,
    skillCount: 0,
  },
  providers: [
    {
      id: 'claude-code',
      name: 'Claude Code',
      universal: false,
      detected: true,
      skillsDir: '/Users/mock/.claude/skills',
      skillsDirExists: true,
      skillCount: 1,
    },
  ],
  skills: [
    {
      name: 'code-review',
      description: 'Review code for quality issues',
      scope: 'global',
      providerIds: ['claude-code'],
      paths: [{ path: '/Users/mock/.claude/skills/code-review' }],
    },
  ],
  warnings: [
    {
      code: 'universal_empty',
      message: 'Universal skills directory has no valid skills',
      path: '/Users/mock/.agents/skills',
    },
  ],
}

/** Empty scan with structured warnings. */
export const MOCK_EMPTY_SCAN: InstalledScanSnapshot = {
  ...MOCK_INSTALLED_SCAN,
  scannedAt: '2026-07-20T00:03:00.000Z',
  universal: {
    skillsDir: '/Users/mock/.agents/skills',
    skillsDirExists: false,
    skillCount: 0,
  },
  providers: [
    {
      id: 'claude-code',
      name: 'Claude Code',
      universal: false,
      detected: true,
      skillsDir: '/Users/mock/.claude/skills',
      skillsDirExists: false,
      skillCount: 0,
    },
  ],
  skills: [],
  warnings: [
    {
      code: 'universal_empty',
      message: 'Universal skills directory is missing or empty',
      path: '/Users/mock/.agents/skills',
    },
    {
      code: 'skills_dir_missing',
      message: 'Claude Code skills directory is missing',
      providerId: 'claude-code',
      path: '/Users/mock/.claude/skills',
    },
  ],
}

export const MOCK_INSTALLED_SKILLS = skillEntriesFromScan(MOCK_INSTALLED_SCAN)
