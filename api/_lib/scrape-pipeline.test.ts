import { describe, expect, it, vi } from 'vitest';
import { runScrapePipeline } from './scrape-pipeline.js';

function detail(hash: string | null, id = 'owner/skill') {
  return {
    id,
    source: 'owner/repo',
    slug: 'skill',
    installs: 10,
    hash,
    url: `https://skills.sh/${id}`,
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
});
