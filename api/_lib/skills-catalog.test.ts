import { describe, expect, it } from 'vitest';
import {
  fetchAllLeaderboard,
  fetchLeaderboard,
  fetchLeaderboardPage,
  fetchSkillAudits,
  fetchSkillDetail,
} from './skills-catalog.js';

describe('skills catalog client', () => {
  it('loads leaderboard and detail response shapes', async () => {
    const responses: unknown[] = [
      {
        data: [
          {
            id: 'owner/skill',
            source: 'owner/repo',
            slug: 'skill',
            installs: 3,
          },
        ],
      },
      {
        id: 'owner/skill',
        source: 'owner/repo',
        slug: 'skill',
        installs: 3,
        hash: 'sha256:abc',
        files: [{ path: 'SKILL.md', contents: '# Skill' }],
      },
      {
        id: 'owner/pending',
        source: 'owner/repo',
        slug: 'pending',
        installs: 1,
        hash: null,
        files: null,
      },
    ];
    const fetcher = async () => responses.shift();
    await expect(fetchLeaderboard(1, fetcher)).resolves.toHaveLength(1);
    await expect(fetchSkillDetail('owner/skill', fetcher)).resolves.toMatchObject({
      hash: 'sha256:abc',
    });
    await expect(fetchSkillDetail('owner/pending', fetcher)).resolves.toMatchObject({
      hash: null,
      files: null,
    });
  });

  it('loads audit payloads and maps upstream 404 to null', async () => {
    await expect(
      fetchSkillAudits('owner/skill', async () => ({
        id: 'owner/skill',
        source: 'owner/repo',
        slug: 'skill',
        audits: [],
      })),
    ).resolves.toMatchObject({ id: 'owner/skill', audits: [] });

    await expect(
      fetchSkillAudits('owner/missing', async () => {
        throw new Error('skills.sh request failed: 404');
      }),
    ).resolves.toBeNull();
  });

  it('fetches a leaderboard page for a named view', async () => {
    const urls: string[] = [];
    const fetcher = async (url: string) => {
      urls.push(url);
      return {
        data: [{ id: 'a/b', source: 'a/b', slug: 'b', installs: 1 }],
      };
    };

    await expect(fetchLeaderboardPage('trending', 2, 50, fetcher)).resolves.toHaveLength(1);
    expect(urls[0]).toContain('view=trending');
    expect(urls[0]).toContain('page=2');
    expect(urls[0]).toContain('per_page=50');
  });

  it('paginates until a short page', async () => {
    const urls: string[] = [];
    const pages: Record<string, unknown> = {
      'page=0': {
        data: [
          { id: 'a/1', source: 'a/1', slug: '1', installs: 2 },
          { id: 'a/2', source: 'a/2', slug: '2', installs: 1 },
        ],
      },
      'page=1': {
        data: [{ id: 'a/3', source: 'a/3', slug: '3', installs: 1 }],
      },
    };
    const fetcher = async (url: string) => {
      urls.push(url);
      const key = [...Object.keys(pages)].find((part) => url.includes(part));
      return pages[key ?? 'page=0'];
    };

    await expect(fetchAllLeaderboard('hot', 2, fetcher)).resolves.toHaveLength(3);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain('view=hot');
  });
});
