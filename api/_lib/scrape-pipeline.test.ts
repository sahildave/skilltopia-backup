import { describe, expect, it, vi } from 'vitest';
import {
  runScrapePipeline,
  scrapeSkipCachedFromEnv,
  skillIdsFromEnv,
} from './scrape-pipeline.js';

function detail(hash: string | null, id = 'owner/skill', url?: string | null) {
  return {
    id,
    source: id.includes('.') && id.split('/').length === 2 ? id.split('/')[0]! : 'owner/repo',
    slug: id.split('/').pop() ?? 'skill',
    installs: 10,
    hash,
    ...(url === undefined ? { url: `https://skills.sh/${id}` } : url === null ? {} : { url }),
    files: hash ? [{ path: 'SKILL.md', contents: '# Skill' }] : null,
  };
}

const pageHtml = `
<main>
  <h1>skill</h1>
  <svg aria-label="Weekly installs: 1, 2, 3, 4, 5, 6, 7, 8"></svg>
  <div>Summary</div><strong>Hello</strong>
</main>
`;

describe('scrape pipeline', () => {
  function repositoryStub(overrides: Record<string, unknown> = {}) {
    return {
      upsertSkillMetadata: vi.fn(),
      upsertPageSnapshot: vi.fn(),
      countInstallSnapshots: vi.fn(),
      upsertInstallSnapshots: vi.fn(),
      getSkillAuditCache: vi.fn().mockResolvedValue(null),
      getSkillPageCache: vi.fn().mockResolvedValue(null),
      listSkillPageCaches: vi.fn().mockResolvedValue([]),
      upsertSkillAudits: vi.fn(),
      ...overrides,
    };
  }

  it('skips skills with a null detail hash', async () => {
    const repository = repositoryStub();

    await expect(
      runScrapePipeline({
        repository: repository as never,
        maxEnriched: 1,
        throttleMs: 0,
        loadLeaderboard: async () => [detail(null)],
        loadDetail: async () => detail(null),
        fetchPageHtml: vi.fn(),
      }),
    ).resolves.toMatchObject({ attempted: 1, scraped: 0, skipped: 1, failed: [] });

    expect(repository.upsertSkillMetadata).not.toHaveBeenCalled();
    expect(repository.upsertPageSnapshot).not.toHaveBeenCalled();
  });

  it('retries scrape once then clears page_snapshot to null for later rotation', async () => {
    const repository = repositoryStub();
    const fetchPageHtml = vi
      .fn()
      .mockRejectedValueOnce(new Error('timeout'))
      .mockRejectedValueOnce(new Error('timeout again'));

    await expect(
      runScrapePipeline({
        repository: repository as never,
        maxEnriched: 1,
        throttleMs: 0,
        loadLeaderboard: async () => [detail('sha256:abc')],
        loadDetail: async () => detail('sha256:abc'),
        fetchPageHtml,
        loadAudits: async () => null,
      }),
    ).resolves.toMatchObject({
      attempted: 1,
      scraped: 0,
      skipped: 0,
      failed: [{ skillId: 'owner/skill' }],
    });

    expect(fetchPageHtml).toHaveBeenCalledTimes(2);
    expect(repository.upsertSkillMetadata).toHaveBeenCalledTimes(1);
    expect(repository.upsertPageSnapshot).toHaveBeenCalledWith(
      'owner/skill',
      null,
      expect.any(String),
    );
    expect(repository.upsertInstallSnapshots).not.toHaveBeenCalled();
  });

  it('refreshes audits when content hash changed', async () => {
    const upsertSkillAudits = vi.fn();
    const repository = repositoryStub({
      getSkillAuditCache: vi.fn().mockResolvedValue({
        contentHash: 'sha256:old',
        audits: {
          id: 'owner/skill',
          source: 'owner/repo',
          slug: 'skill',
          audits: [],
        },
        auditsFetchedAt: new Date().toISOString(),
      }),
      upsertSkillAudits,
      countInstallSnapshots: vi.fn().mockResolvedValue(8),
    });
    const loadAudits = vi.fn(async () => ({
      id: 'owner/skill',
      source: 'owner/repo',
      slug: 'skill',
      audits: [
        {
          provider: 'Socket',
          slug: 'socket',
          status: 'pass',
          summary: 'ok',
          auditedAt: '2026-07-21T00:00:00.000Z',
        },
      ],
    }));

    await runScrapePipeline({
      repository: repository as never,
      maxEnriched: 1,
      throttleMs: 0,
      scrapeDate: new Date('2026-07-21T12:00:00.000Z'),
      loadLeaderboard: async () => [detail('sha256:new')],
      loadDetail: async () => detail('sha256:new'),
      loadAudits,
      fetchPageHtml: async () => pageHtml,
    });

    expect(loadAudits).toHaveBeenCalledWith('owner/skill');
    expect(upsertSkillAudits).toHaveBeenCalled();
  });

  it('backfills install snapshots only when existing row count is under 8', async () => {
    const upsertInstallSnapshots = vi.fn();
    const repository = repositoryStub({
      countInstallSnapshots: vi.fn().mockResolvedValue(3),
      upsertInstallSnapshots,
    });

    await expect(
      runScrapePipeline({
        repository: repository as never,
        maxEnriched: 1,
        throttleMs: 0,
        scrapeDate: new Date('2026-07-21T12:00:00.000Z'),
        loadLeaderboard: async () => [detail('sha256:abc')],
        loadDetail: async () => detail('sha256:abc'),
        loadAudits: async () => null,
        fetchPageHtml: async () => pageHtml,
      }),
    ).resolves.toMatchObject({ scraped: 1 });

    expect(upsertInstallSnapshots).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ skillId: 'owner/skill', date: '2026-07-14', installs: 1 }),
        expect.objectContaining({ skillId: 'owner/skill', date: '2026-07-21', installs: 8 }),
      ]),
    );

    repository.countInstallSnapshots.mockResolvedValue(8);
    upsertInstallSnapshots.mockClear();

    await runScrapePipeline({
      repository: repository as never,
      maxEnriched: 1,
      throttleMs: 0,
      scrapeDate: new Date('2026-07-21T12:00:00.000Z'),
      loadLeaderboard: async () => [detail('sha256:abc')],
      loadDetail: async () => detail('sha256:abc'),
      loadAudits: async () => null,
      fetchPageHtml: async () => pageHtml,
    });
    expect(upsertInstallSnapshots).not.toHaveBeenCalled();
  });

  it('scrapes explicit skillIds without calling the leaderboard', async () => {
    const repository = repositoryStub({
      countInstallSnapshots: vi.fn().mockResolvedValue(8),
    });
    const loadLeaderboard = vi.fn();
    const loadDetail = vi.fn(async (id: string) => detail('sha256:abc', id));

    await expect(
      runScrapePipeline({
        repository: repository as never,
        skillIds: ['a/one', 'b/two'],
        maxEnriched: 10,
        throttleMs: 0,
        loadLeaderboard,
        loadDetail,
        loadAudits: async () => null,
        fetchPageHtml: async () => pageHtml,
      }),
    ).resolves.toMatchObject({ attempted: 2, scraped: 2, skipped: 0, failed: [] });

    expect(loadLeaderboard).not.toHaveBeenCalled();
    expect(loadDetail).toHaveBeenCalledWith('a/one');
    expect(loadDetail).toHaveBeenCalledWith('b/two');
  });

  it('reads SKILL_IDS from env via skillIdsFromEnv', () => {
    expect(skillIdsFromEnv({ SKILL_IDS: ' a/b , c/d/e ' })).toEqual(['a/b', 'c/d/e']);
    expect(skillIdsFromEnv({})).toBeUndefined();
  });

  it('reads SCRAPE_SKIP_CACHED from env', () => {
    expect(scrapeSkipCachedFromEnv({})).toBe(false);
    expect(scrapeSkipCachedFromEnv({ SCRAPE_SKIP_CACHED: '1' })).toBe(true);
    expect(scrapeSkipCachedFromEnv({ SCRAPE_SKIP_CACHED: 'true' })).toBe(true);
    expect(scrapeSkipCachedFromEnv({ SCRAPE_SKIP_CACHED: 'no' })).toBe(false);
  });

  it('skipCached drops ids that already have page_snapshot', async () => {
    const loadDetail = vi.fn(async (id: string) => detail('sha256:abc', id));
    const repository = repositoryStub({
      countInstallSnapshots: vi.fn().mockResolvedValue(8),
      listSkillPageCaches: vi.fn().mockResolvedValue([
        {
          skillId: 'a/one',
          pageSnapshot: { summary: 'cached' },
          pageScrapedAt: '2026-07-21T00:00:00.000Z',
          repository: 'a',
          source: null,
          installCount: 1,
          sourceUrl: null,
        },
        {
          skillId: 'b/two',
          pageSnapshot: null,
          pageScrapedAt: null,
          repository: null,
          source: null,
          installCount: 2,
          sourceUrl: null,
        },
      ]),
    });

    await expect(
      runScrapePipeline({
        repository: repository as never,
        skillIds: ['a/one', 'b/two', 'c/three'],
        skipCached: true,
        maxEnriched: 10,
        throttleMs: 0,
        loadDetail,
        loadAudits: async () => null,
        fetchPageHtml: async () => pageHtml,
      }),
    ).resolves.toMatchObject({
      attempted: 2,
      scraped: 2,
      cachedSkipped: 1,
      failed: [],
    });

    expect(loadDetail).not.toHaveBeenCalledWith('a/one');
    expect(loadDetail).toHaveBeenCalledWith('b/two');
    expect(loadDetail).toHaveBeenCalledWith('c/three');
  });

  it('does not filter cached ids when skipCached is false (rotation-safe)', async () => {
    const loadDetail = vi.fn(async (id: string) => detail('sha256:abc', id));
    const listSkillPageCaches = vi.fn();
    const repository = repositoryStub({
      countInstallSnapshots: vi.fn().mockResolvedValue(8),
      listSkillPageCaches,
    });

    await expect(
      runScrapePipeline({
        repository: repository as never,
        skillIds: ['a/one'],
        skipCached: false,
        maxEnriched: 10,
        throttleMs: 0,
        loadDetail,
        loadAudits: async () => null,
        fetchPageHtml: async () => pageHtml,
      }),
    ).resolves.toMatchObject({ attempted: 1, scraped: 1, cachedSkipped: 0 });

    expect(listSkillPageCaches).not.toHaveBeenCalled();
    expect(loadDetail).toHaveBeenCalledWith('a/one');
  });

  it('stops between skills when AbortSignal fires', async () => {
    const repository = repositoryStub({
      countInstallSnapshots: vi.fn().mockResolvedValue(8),
    });
    const abort = new AbortController();
    const loadDetail = vi.fn(async (id: string) => {
      if (id === 'b/two') abort.abort();
      return detail('sha256:abc', id);
    });

    await expect(
      runScrapePipeline({
        repository: repository as never,
        skillIds: ['a/one', 'b/two', 'c/three'],
        maxEnriched: 10,
        throttleMs: 0,
        signal: abort.signal,
        loadDetail,
        loadAudits: async () => null,
        fetchPageHtml: async () => pageHtml,
      }),
    ).resolves.toMatchObject({ attempted: 2, scraped: 2, aborted: true });

    expect(loadDetail).toHaveBeenCalledTimes(2);
    expect(loadDetail).not.toHaveBeenCalledWith('c/three');
  });

  it('fetches /site/ HTML and stores page url when detail omits url (well-known)', async () => {
    const repository = repositoryStub({
      countInstallSnapshots: vi.fn().mockResolvedValue(8),
    });
    const fetchPageHtml = vi.fn(async () => pageHtml);
    const skillId = 'open.feishu.cn/lark-approval';

    await expect(
      runScrapePipeline({
        repository: repository as never,
        skillIds: [skillId],
        maxEnriched: 1,
        throttleMs: 0,
        loadDetail: async () => detail('sha256:abc', skillId, null),
        loadAudits: async () => null,
        fetchPageHtml,
      }),
    ).resolves.toMatchObject({ scraped: 1, failed: [] });

    expect(fetchPageHtml).toHaveBeenCalledWith(
      'https://www.skills.sh/site/open.feishu.cn/lark-approval',
    );
    expect(repository.upsertSkillMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        skillId,
        sourceUrl: 'https://www.skills.sh/site/open.feishu.cn/lark-approval',
        source: 'https://open.feishu.cn',
        repository: undefined,
      }),
    );
  });

  it('keeps the requested skill id when detail strips characters (e.g. colon)', async () => {
    const repository = repositoryStub({
      countInstallSnapshots: vi.fn().mockResolvedValue(8),
      getSkillPageCache: vi.fn().mockResolvedValue({
        skillId: 'google-labs-code/stitch-skills/react:components',
        pageSnapshot: null,
        pageScrapedAt: null,
        repository: 'google-labs-code/stitch-skills',
        source: null,
        installCount: 50_432,
        sourceUrl: 'https://www.skills.sh/google-labs-code/stitch-skills/react%3Acomponents',
      }),
    });
    const requestedId = 'google-labs-code/stitch-skills/react:components';
    const mangledId = 'google-labs-code/stitch-skills/reactcomponents';
    const fetchPageHtml = vi.fn(async () => pageHtml);
    const loadAudits = vi.fn(async () => null);

    await expect(
      runScrapePipeline({
        repository: repository as never,
        skillIds: [requestedId],
        maxEnriched: 1,
        throttleMs: 0,
        loadDetail: async () => ({
          ...detail('sha256:abc', mangledId, null),
          installs: 0,
          source: 'google-labs-code/stitch-skills',
        }),
        loadAudits,
        fetchPageHtml,
      }),
    ).resolves.toMatchObject({ scraped: 1, failed: [] });

    expect(fetchPageHtml).toHaveBeenCalledWith(
      'https://www.skills.sh/google-labs-code/stitch-skills/react%3Acomponents',
    );
    expect(repository.upsertSkillMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        skillId: requestedId,
        sourceUrl: 'https://www.skills.sh/google-labs-code/stitch-skills/react%3Acomponents',
        installCount: 50_432,
        rawStoragePrefix: requestedId,
      }),
    );
    expect(repository.getSkillAuditCache).toHaveBeenCalledWith(requestedId);
    expect(loadAudits).toHaveBeenCalledWith(requestedId);
    expect(repository.upsertPageSnapshot).toHaveBeenCalledWith(
      requestedId,
      expect.objectContaining({ summary: 'Hello' }),
      expect.any(String),
    );
    expect(repository.upsertSkillMetadata).not.toHaveBeenCalledWith(
      expect.objectContaining({ skillId: mangledId }),
    );
  });
});
