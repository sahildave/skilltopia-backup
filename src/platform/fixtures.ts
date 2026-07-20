import type { InstalledScanSnapshot } from './types'
import { UNIVERSAL_PROVIDER_ID } from './types'
import { skillEntriesFromScan } from './scan-utils'

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
        '/Users/mock/.agents/skills/find-skills',
        '/Users/mock/.claude/skills/find-skills',
      ],
    },
    {
      name: 'frontend-design',
      description: 'Create distinctive frontend interfaces',
      scope: 'global',
      providerIds: [UNIVERSAL_PROVIDER_ID],
      paths: ['/Users/mock/.agents/skills/frontend-design'],
    },
    {
      name: 'code-review',
      description: 'Review code for quality issues',
      scope: 'global',
      providerIds: ['claude-code'],
      paths: ['/Users/mock/.claude/skills/code-review'],
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

export const MOCK_INSTALLED_SKILLS = skillEntriesFromScan(MOCK_INSTALLED_SCAN)
