import type { SkillAuditsData, SkillDetailData, SkillsShSkill } from './types';

export const MOCK_LEADERBOARD: SkillsShSkill[] = [
  {
    id: 'vercel-labs/agent-skills/find-skills',
    slug: 'find-skills',
    name: 'Find Skills',
    source: 'vercel-labs/agent-skills',
    installs: 128_000,
    sourceType: 'github',
    installUrl: 'https://skills.sh/vercel-labs/agent-skills/find-skills',
    url: 'https://skills.sh/vercel-labs/agent-skills/find-skills',
  },
  {
    id: 'anthropics/skills/frontend-design',
    slug: 'frontend-design',
    name: 'Frontend Design',
    source: 'anthropics/skills',
    installs: 64_000,
    sourceType: 'github',
    installUrl: 'https://skills.sh/anthropics/skills/frontend-design',
    url: 'https://skills.sh/anthropics/skills/frontend-design',
  },
];

export const MOCK_DETAIL: SkillDetailData = {
  skillId: 'vercel-labs/agent-skills/find-skills',
  pageSnapshot: {
    summary: 'Discover and install agent skills',
    topics: ['exploration', 'onboarding'],
    repository: 'vercel-labs/agent-skills',
    weeklyInstalls: [100, 110, 120, 130, 140, 150, 160, 170],
  },
  pageScrapedAt: '2026-07-20T00:00:00.000Z',
  repository: 'vercel-labs/agent-skills',
  installCount: 128_000,
  sourceUrl: 'https://github.com/vercel-labs/agent-skills',
  installSeries: [100, 110, 120, 130, 140, 150, 160, 170],
  enrichment: {
    skillId: 'vercel-labs/agent-skills/find-skills',
    contentHash: 'mock-hash',
    required: {
      primaryGoal: 'Discover and install agent skills',
      requires: ['network'],
      estimatedComplexity: 'low',
      bestFor: ['exploration', 'onboarding'],
    },
    optional: {},
    estimatedReadTimeMinutes: 3,
  },
  related: [],
};

export const MOCK_UNCACHED_DETAIL: SkillDetailData = {
  skillId: 'anthropics/skills/frontend-design',
  pageSnapshot: null,
  pageScrapedAt: null,
  repository: null,
  installCount: 64_000,
  sourceUrl: null,
  installSeries: [],
  enrichment: null,
  related: [],
};

export const MOCK_AUDITS: SkillAuditsData = {
  skillId: 'vercel-labs/agent-skills/find-skills',
  source: 'cache',
  auditsFetchedAt: '2026-07-20T00:00:00.000Z',
  audits: {
    id: 'vercel-labs/agent-skills/find-skills',
    source: 'vercel-labs/agent-skills',
    slug: 'find-skills',
    audits: [
      {
        provider: 'Socket',
        slug: 'socket',
        status: 'pass',
        summary: 'No alerts',
        auditedAt: '2026-04-15T12:05:00.000Z',
      },
    ],
  },
};
