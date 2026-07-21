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
  it('skips skills with a null detail hash', async () => {
    const repository = {
      upsertSkillMetadata: vi.fn(),
      upsertPageSnapshot: vi.fn(),
      countInstallSnapshots: vi.fn(),
      upsertInstallSnapshots: vi.fn(),
    };

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

  it('retries scrape once then saves metadata without clearing page_snapshot', async () => {
    const repository = {
      upsertSkillMetadata: vi.fn(),
      upsertPageSnapshot: vi.fn(),
      countInstallSnapshots: vi.fn(),
      upsertInstallSnapshots: vi.fn(),
    };
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
      }),
    ).resolves.toMatchObject({
      attempted: 1,
      scraped: 0,
      skipped: 0,
      failed: [{ skillId: 'owner/skill' }],
    });

    expect(fetchPageHtml).toHaveBeenCalledTimes(2);
    expect(repository.upsertSkillMetadata).toHaveBeenCalledTimes(1);
    expect(repository.upsertPageSnapshot).not.toHaveBeenCalled();
    expect(repository.upsertInstallSnapshots).not.toHaveBeenCalled();
  });

  it('backfills install snapshots only when existing row count is under 8', async () => {
    const upsertInstallSnapshots = vi.fn();
    const repository = {
      upsertSkillMetadata: vi.fn(),
      upsertPageSnapshot: vi.fn(),
      countInstallSnapshots: vi.fn().mockResolvedValue(3),
      upsertInstallSnapshots,
    };

    await expect(
      runScrapePipeline({
        repository: repository as never,
        maxEnriched: 1,
        throttleMs: 0,
        scrapeDate: new Date('2026-07-21T12:00:00.000Z'),
        loadLeaderboard: async () => [detail('sha256:abc')],
        loadDetail: async () => detail('sha256:abc'),
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
      fetchPageHtml: async () => pageHtml,
    });
    expect(upsertInstallSnapshots).not.toHaveBeenCalled();
  });
});
