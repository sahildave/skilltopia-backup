import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getVercelOidcToken } = vi.hoisted(() => ({
  getVercelOidcToken: vi.fn(),
}));

vi.mock('@vercel/oidc', () => ({ getVercelOidcToken }));

const { createSupabaseRepositoryFromEnv } = vi.hoisted(() => ({
  createSupabaseRepositoryFromEnv: vi.fn(),
}));

vi.mock('./_lib/supabase-repository.js', () => ({ createSupabaseRepositoryFromEnv }));

import { GET as getSkills, POST as postSkills } from './skills.js';
import { GET as getSkillAudits } from './skills/audit.js';
import { GET as getSkillDetail } from './skills/detail.js';
import { GET as getSkillPageCacheBatch } from './skills/page-cache.js';
import { GET as searchSkills } from './skills/search.js';
import { GET as getSkillSeed } from './skills/seed.js';

describe('skills proxy routes', () => {
  beforeEach(() => {
    getVercelOidcToken.mockReset();
    getVercelOidcToken.mockResolvedValue('upstream-secret');
    vi.unstubAllGlobals();
    createSupabaseRepositoryFromEnv.mockReset();
  });

  it('rejects invalid leaderboard queries before contacting upstream', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await getSkills(new Request('https://proxy.test/api/skills?per_page=501'));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'invalid_query',
      message: 'per_page must be between 1 and 500',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getVercelOidcToken).not.toHaveBeenCalled();
  });

  it('seeds with the app OIDC token, never the batch ingest token', async () => {
    process.env.VERCEL_OIDC_TOKEN_SECONDARY = 'batch-secret';
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [{ id: 'owner/repo/skill', slug: 'skill' }] }), {
        status: 200,
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    createSupabaseRepositoryFromEnv.mockReturnValue({
      getSkillMetadata: vi.fn().mockResolvedValue([]),
    });

    const response = await getSkillSeed(new Request('https://proxy.test/api/skills/seed'));

    expect(response.status).toBe(200);
    expect(getVercelOidcToken).toHaveBeenCalled();
    const headers = new Headers(fetchMock.mock.calls[0]![1].headers);
    expect(headers.get('Authorization')).toBe('Bearer upstream-secret');
    delete process.env.VERCEL_OIDC_TOKEN_SECONDARY;
  });

  it('rejects unsupported methods', async () => {
    const response = await postSkills();

    expect(response.status).toBe(405);
    expect(await response.json()).toEqual({
      error: 'method_not_allowed',
      message: 'Only GET is supported.',
    });
  });

  it('forwards approved search queries and keeps upstream credentials server-side', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=60',
          'X-RateLimit-Limit': '600',
          'X-RateLimit-Remaining': '599',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await searchSkills(
      new Request('https://proxy.test/api/skills/search?q=react&limit=5'),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: [] });
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=60');
    expect(response.headers.get('Authorization')).toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      'https://skills.sh/api/v1/skills/search?q=react&limit=5',
      {
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer upstream-secret',
        },
      },
    );
  });

  it('serves cached audits without upstream OIDC when fresh', async () => {
    const audits = {
      id: 'owner/repo/skill',
      source: 'owner/repo',
      slug: 'skill',
      audits: [],
    };
    createSupabaseRepositoryFromEnv.mockReturnValue({
      getSkillAuditCache: async () => ({
        contentHash: 'sha256:abc',
        audits,
        auditsFetchedAt: new Date().toISOString(),
      }),
      upsertSkillAudits: vi.fn(),
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await getSkillAudits(
      new Request('https://proxy.test/api/skills/audit?skill_id=owner/repo/skill'),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        skillId: 'owner/repo/skill',
        audits,
        source: 'cache',
        auditsFetchedAt: expect.any(String),
      },
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(getVercelOidcToken).not.toHaveBeenCalled();
  });

  it('serves page cache and install series from Supabase without live scrape', async () => {
    const pageSnapshot = {
      summary: 'A skill',
      topics: ['design'],
      repository: 'owner/repo',
      weeklyInstalls: [1, 2, 3, 4, 5, 6, 7, 8],
    };
    createSupabaseRepositoryFromEnv.mockReturnValue({
      getSkillPageCache: async () => ({
        skillId: 'owner/repo/skill',
        pageSnapshot,
        pageScrapedAt: '2026-07-20T00:00:00.000Z',
        repository: 'owner/repo',
        installCount: 99,
        sourceUrl: 'https://github.com/owner/repo',
      }),
      listInstallSnapshots: vi.fn(),
      getSkillEnrichment: async () => null,
    });

    const response = await getSkillDetail(
      new Request('https://proxy.test/api/skills/detail?skill_id=owner/repo/skill'),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        skillId: 'owner/repo/skill',
        pageSnapshot,
        pageScrapedAt: '2026-07-20T00:00:00.000Z',
        repository: 'owner/repo',
        source: null,
        installCount: 99,
        sourceUrl: 'https://github.com/owner/repo',
        installSeries: [1, 2, 3, 4, 5, 6, 7, 8],
        enrichment: null,
        related: [],
      },
    });
  });

  it('falls back to install snapshots when weekly series is absent', async () => {
    createSupabaseRepositoryFromEnv.mockReturnValue({
      getSkillPageCache: async () => ({
        skillId: 'owner/repo/skill',
        pageSnapshot: { summary: 'Cached without chart' },
        pageScrapedAt: '2026-07-20T00:00:00.000Z',
        repository: null,
        installCount: 10,
        sourceUrl: null,
      }),
      listInstallSnapshots: async () => [
        { skillId: 'owner/repo/skill', date: '2026-07-14', installs: 1 },
        { skillId: 'owner/repo/skill', date: '2026-07-15', installs: 2 },
      ],
      getSkillEnrichment: async () => null,
    });

    const response = await getSkillDetail(
      new Request('https://proxy.test/api/skills/detail?skill_id=owner/repo/skill'),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: expect.objectContaining({
        installSeries: [1, 2],
        pageSnapshot: { summary: 'Cached without chart' },
      }),
    });
  });

  it('batches page-cache rows in request order and fills missing ids', async () => {
    createSupabaseRepositoryFromEnv.mockReturnValue({
      listSkillPageCaches: async () => [
        {
          skillId: 'owner/b',
          pageSnapshot: { summary: 'B' },
          pageScrapedAt: '2026-07-20T00:00:00.000Z',
          repository: 'owner/repo',
          source: null,
          installCount: 2,
          sourceUrl: 'https://example.com/b',
        },
      ],
    });

    const response = await getSkillPageCacheBatch(
      new Request('https://proxy.test/api/skills/page-cache?skill_ids=owner%2Fa,owner%2Fb'),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: [
        {
          skillId: 'owner/a',
          pageSnapshot: null,
          pageScrapedAt: null,
          repository: null,
          source: null,
          installCount: null,
          sourceUrl: null,
        },
        {
          skillId: 'owner/b',
          pageSnapshot: { summary: 'B' },
          pageScrapedAt: '2026-07-20T00:00:00.000Z',
          repository: 'owner/repo',
          source: null,
          installCount: 2,
          sourceUrl: 'https://example.com/b',
        },
      ],
    });
  });

  it('rejects oversized page-cache batches before touching Supabase', async () => {
    const tooMany = Array.from({ length: 101 }, (_, i) => `owner/skill-${i}`).join(',');
    const response = await getSkillPageCacheBatch(
      new Request(
        `https://proxy.test/api/skills/page-cache?skill_ids=${encodeURIComponent(tooMany)}`,
      ),
    );

    expect(response.status).toBe(400);
    expect(createSupabaseRepositoryFromEnv).not.toHaveBeenCalled();
  });
});
