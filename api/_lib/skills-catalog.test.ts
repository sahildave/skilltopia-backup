import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAllLeaderboard,
  fetchJson,
  fetchLeaderboard,
  fetchLeaderboardPage,
  fetchSkillAudits,
  fetchSkillDetail,
  classifySkillOrigin,
  resolveBatchOidcToken,
  skillPageUrl,
} from './skills-catalog.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('skillPageUrl', () => {
  it('prefers a known url from the list API', () => {
    expect(
      skillPageUrl(
        'open.feishu.cn/lark-approval',
        'https://www.skills.sh/site/open.feishu.cn/lark-approval',
      ),
    ).toBe('https://www.skills.sh/site/open.feishu.cn/lark-approval');
  });

  it('reconstructs well-known and GitHub page urls when detail omits url', () => {
    expect(skillPageUrl('open.feishu.cn/lark-approval')).toBe(
      'https://www.skills.sh/site/open.feishu.cn/lark-approval',
    );
    expect(skillPageUrl('mintlify.com/mintlify')).toBe(
      'https://www.skills.sh/site/mintlify.com/mintlify',
    );
    expect(skillPageUrl('anthropics/skills/frontend-design')).toBe(
      'https://www.skills.sh/anthropics/skills/frontend-design',
    );
    expect(skillPageUrl('google-labs-code/stitch-skills/react:components')).toBe(
      'https://www.skills.sh/google-labs-code/stitch-skills/react%3Acomponents',
    );
  });
});

describe('classifySkillOrigin', () => {
  it('maps GitHub skills to repository', () => {
    expect(classifySkillOrigin('vercel-labs/skills/find-skills', 'vercel-labs/skills')).toEqual({
      repository: 'vercel-labs/skills',
    });
  });

  it('maps well-known skills to https source', () => {
    expect(classifySkillOrigin('open.feishu.cn/lark-approval', 'open.feishu.cn')).toEqual({
      source: 'https://open.feishu.cn',
    });
    expect(classifySkillOrigin('open.feishu.cn/lark-approval', 'https://open.feishu.cn')).toEqual({
      source: 'https://open.feishu.cn',
    });
  });

  it('treats host-like API source as external even on odd ids', () => {
    expect(classifySkillOrigin('odd/id', 'https://example.com/skills')).toEqual({
      source: 'https://example.com/skills',
    });
  });
});

describe('resolveBatchOidcToken', () => {
  it('reads VERCEL_OIDC_TOKEN_SECONDARY', () => {
    vi.stubEnv('VERCEL_OIDC_TOKEN_SECONDARY', ' secondary-token ');
    expect(resolveBatchOidcToken()).toBe('secondary-token');
  });

  it('never falls back to the app project VERCEL_OIDC_TOKEN', () => {
    vi.stubEnv('VERCEL_OIDC_TOKEN_SECONDARY', '  ');
    vi.stubEnv('VERCEL_OIDC_TOKEN', 'app-token');
    expect(resolveBatchOidcToken()).toBeUndefined();
  });

  it('returns undefined when the secondary token is not set', () => {
    expect(resolveBatchOidcToken()).toBeUndefined();
  });
});

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

  it('paginates fetchLeaderboard until limit (per_page max 500)', async () => {
    const urls: string[] = [];
    const fetcher = async (url: string) => {
      urls.push(url);
      if (url.includes('page=0')) {
        return {
          data: Array.from({ length: 500 }, (_, i) => ({
            id: `p0/${i}`,
            source: 'a/b',
            slug: String(i),
            installs: 500 - i,
          })),
        };
      }
      if (url.includes('page=1')) {
        return {
          data: Array.from({ length: 500 }, (_, i) => ({
            id: `p1/${i}`,
            source: 'a/b',
            slug: String(i),
            installs: 1,
          })),
        };
      }
      return {
        data: Array.from({ length: 200 }, (_, i) => ({
          id: `p2/${i}`,
          source: 'a/b',
          slug: String(i),
          installs: 1,
        })),
      };
    };

    const skills = await fetchLeaderboard(1200, fetcher);
    expect(skills).toHaveLength(1200);
    expect(skills[0]?.id).toBe('p0/0');
    expect(skills[500]?.id).toBe('p1/0');
    expect(skills[1199]?.id).toBe('p2/199');
    expect(urls).toHaveLength(3);
    expect(urls.every((url) => url.includes('per_page=500'))).toBe(true);
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

describe('fetchJson retries', () => {
  function jsonResponse(status: number) {
    return { ok: status < 400, status, json: async () => ({ data: [] }) } as Response;
  }

  /**
   * Attach the assertion before advancing timers. Awaiting the timers first
   * leaves the rejection unhandled, which vitest reports as a run-level error
   * even though every test passes.
   */
  async function settle<T>(assertion: Promise<T>): Promise<T> {
    await vi.runAllTimersAsync();
    return assertion;
  }

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('retries a 500 and succeeds', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(500))
      .mockResolvedValueOnce(jsonResponse(200));
    vi.stubGlobal('fetch', fetchMock);

    await settle(expect(fetchJson('https://skills.sh/x')).resolves.toEqual({ data: [] }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries a 429', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429))
      .mockResolvedValueOnce(jsonResponse(200));
    vi.stubGlobal('fetch', fetchMock);

    await settle(expect(fetchJson('https://skills.sh/x')).resolves.toEqual({ data: [] }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry a 401 — a bad token will not fix itself', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(401));
    vi.stubGlobal('fetch', fetchMock);

    await settle(expect(fetchJson('https://skills.sh/x')).rejects.toThrow('401'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives up after the last attempt and reports the status', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(503));
    vi.stubGlobal('fetch', fetchMock);

    await settle(expect(fetchJson('https://skills.sh/x')).rejects.toThrow('503'));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('retries a network error', async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValueOnce(jsonResponse(200));
    vi.stubGlobal('fetch', fetchMock);

    await settle(expect(fetchJson('https://skills.sh/x')).resolves.toEqual({ data: [] }));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
