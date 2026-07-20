import type { SkillDetailData, SkillsShSkill } from './types';

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
