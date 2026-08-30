import type { SkillsShSkill } from '@/catalog/types';
import { describe, expect, it } from 'vitest';
import {
  collectCachedLeaderboardSkills,
  filterSkillsLocally,
  mergeLocalAndApiSkills,
  shouldMergeApiResults,
} from './local-skills-search';

function skill(
  partial: Partial<SkillsShSkill> & Pick<SkillsShSkill, 'id' | 'name'>,
): SkillsShSkill {
  return {
    slug: partial.slug ?? partial.id.split('/').at(-1) ?? partial.id,
    source: partial.source ?? 'org/repo',
    installs: partial.installs ?? 0,
    sourceType: partial.sourceType ?? 'github',
    url: partial.url ?? `https://skills.sh/${partial.id}`,
    ...partial,
  };
}

describe('collectCachedLeaderboardSkills', () => {
  it('dedupes skills across leaderboard tab entries by id', () => {
    const shared = skill({ id: 'a/b/shared', name: 'Shared' });
    const trendingOnly = skill({ id: 'a/b/trending', name: 'Trending Only' });
    const hotOnly = skill({ id: 'a/b/hot', name: 'Hot Only' });

    const result = collectCachedLeaderboardSkills([
      { data: [shared, trendingOnly], dataUpdatedAt: 100 },
      { data: [shared, hotOnly], dataUpdatedAt: 200 },
    ]);

    expect(result.map((s) => s.id)).toEqual(['a/b/shared', 'a/b/trending', 'a/b/hot']);
  });

  it('prefers fetched entries (dataUpdatedAt > 0) and ignores seed-only tabs', () => {
    const seeded = skill({ id: 'seed/only', name: 'Seed' });
    const fetched = skill({ id: 'live/fetched', name: 'Fetched' });

    const result = collectCachedLeaderboardSkills(
      [
        { data: [seeded], dataUpdatedAt: 0 },
        { data: [fetched], dataUpdatedAt: 50 },
      ],
      [skill({ id: 'fallback/skill', name: 'Fallback' })],
    );

    expect(result.map((s) => s.id)).toEqual(['live/fetched']);
  });

  it('falls back to active-tab skills when nothing has been fetched yet', () => {
    const seeded = skill({ id: 'seed/only', name: 'Seed' });
    const fallback = skill({ id: 'fallback/skill', name: 'Fallback' });

    const result = collectCachedLeaderboardSkills(
      [{ data: [seeded], dataUpdatedAt: 0 }],
      [fallback],
    );

    expect(result.map((s) => s.id)).toEqual(['fallback/skill']);
  });
});

describe('filterSkillsLocally', () => {
  const corpus = [
    skill({
      id: 'acme/skills/find-skills',
      name: 'Find Skills',
      slug: 'find-skills',
      source: 'acme/skills',
    }),
    skill({
      id: 'acme/skills/frontend-design',
      name: 'Frontend Design',
      slug: 'frontend-design',
      source: 'acme/skills',
    }),
    skill({ id: 'other/repo/pdfs', name: 'PDFs', slug: 'pdfs', source: 'other/repo' }),
  ];

  it('matches name, slug, and source case-insensitively', () => {
    expect(filterSkillsLocally(corpus, 'find').map((s) => s.id)).toEqual([
      'acme/skills/find-skills',
    ]);
    expect(filterSkillsLocally(corpus, 'FRONTEND').map((s) => s.id)).toEqual([
      'acme/skills/frontend-design',
    ]);
    expect(filterSkillsLocally(corpus, 'other/repo').map((s) => s.id)).toEqual(['other/repo/pdfs']);
  });

  it('returns no matches for queries shorter than 2 characters', () => {
    expect(filterSkillsLocally(corpus, 'f')).toEqual([]);
    expect(filterSkillsLocally(corpus, ' ')).toEqual([]);
  });
});

describe('mergeLocalAndApiSkills', () => {
  it('keeps local order and appends API-only skills by id', () => {
    const local = [skill({ id: 'local/a', name: 'A' }), skill({ id: 'local/b', name: 'B' })];
    const api = [
      skill({ id: 'local/b', name: 'B from API' }),
      skill({ id: 'api/c', name: 'C' }),
      skill({ id: 'api/d', name: 'D' }),
    ];

    expect(mergeLocalAndApiSkills(local, api).map((s) => s.id)).toEqual([
      'local/a',
      'local/b',
      'api/c',
      'api/d',
    ]);
    expect(mergeLocalAndApiSkills(local, api)[1]?.name).toBe('B');
  });

  it('takes categories from the API copy of a skill the local cache also matched', () => {
    const local = [skill({ id: 'local/b', name: 'B' })];
    const api = [skill({ id: 'local/b', name: 'B from API', categories: ['git-github'] })];

    expect(mergeLocalAndApiSkills(local, api)[0]).toMatchObject({
      name: 'B',
      categories: ['git-github'],
    });
  });
});

describe('shouldMergeApiResults', () => {
  it('only allows merge when debounced query matches current input (sync gate)', () => {
    expect(shouldMergeApiResults('react', 'react')).toBe(true);
    expect(shouldMergeApiResults('react ', 'react')).toBe(true);
    expect(shouldMergeApiResults('reacts', 'react')).toBe(false);
    expect(shouldMergeApiResults('re', '')).toBe(false);
  });
});
