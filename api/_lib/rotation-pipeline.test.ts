import { describe, expect, it, vi } from 'vitest';
import { ROTATION_MAX_DEFAULT, runRotationPipeline } from './rotation-pipeline.js';
import { ROTATION_SLOTS } from './rotation-select.js';

describe('rotation pipeline', () => {
  it('selects slot mix plus queued extras then scrapes by skillIds', async () => {
    const top = Array.from({ length: 30 }, (_, i) => ({
      id: `top/${i}`,
      source: 'r',
      slug: `${i}`,
      installs: 100 - i,
    }));
    const hot = Array.from({ length: 20 }, (_, i) => ({
      id: `hot/${i}`,
      source: 'r',
      slug: `h${i}`,
      installs: 50,
    }));
    const trending = Array.from({ length: 20 }, (_, i) => ({
      id: `trend/${i}`,
      source: 'r',
      slug: `t${i}`,
      installs: 40,
    }));
    const oldest = Array.from({ length: 200 }, (_, i) => `old/${i}`);
    const scrape = vi.fn().mockResolvedValue({
      attempted: 202,
      scraped: 202,
      skipped: 0,
      failed: [],
    });

    const result = await runRotationPipeline({
      repository: {
        listOldestPageScraped: vi.fn(),
        listQueuedDetailSkills: vi.fn(),
      } as never,
      throttleMs: 0,
      loadLeaderboardPage: async (view) => {
        if (view === 'all-time') return top;
        if (view === 'hot') return hot;
        return trending;
      },
      loadOldest: async () => oldest,
      loadQueued: async () => ['new/a', 'top/0'],
      extraQueued: ['new/b'],
      scrape,
    });

    expect(result.selected).toBe(
      ROTATION_SLOTS.top + ROTATION_SLOTS.hot + ROTATION_SLOTS.trending + ROTATION_SLOTS.oldest + 2,
    );
    expect(result.queuedExtra).toBe(2);
    expect(scrape).toHaveBeenCalledTimes(1);
    const call = scrape.mock.calls[0]?.[0] as { skillIds: string[]; maxEnriched: number };
    expect(call.skillIds).toContain('new/a');
    expect(call.skillIds).toContain('new/b');
    expect(call.skillIds).toHaveLength(result.selected);
    expect(call.maxEnriched).toBe(result.selected);
  });

  it('caps a large queued backlog so one run has a bounded wall clock', async () => {
    const scrape = vi.fn().mockResolvedValue({ attempted: 0, scraped: 0, skipped: 0, failed: [] });
    const backlog = Array.from({ length: 1_400 }, (_, i) => `queued/${i}`);

    const result = await runRotationPipeline({
      repository: {} as never,
      throttleMs: 0,
      loadLeaderboardPage: async () => [],
      loadOldest: async () => [],
      loadQueued: async () => backlog,
      scrape,
    });

    expect(result.selected).toBe(ROTATION_MAX_DEFAULT);
    expect(result.dropped).toBe(backlog.length - ROTATION_MAX_DEFAULT);
    const call = scrape.mock.calls[0]?.[0] as { skillIds: string[] };
    expect(call.skillIds).toHaveLength(ROTATION_MAX_DEFAULT);
  });

  it('keeps the fixed slots when capping — backlog is what gets dropped', async () => {
    const scrape = vi.fn().mockResolvedValue({ attempted: 0, scraped: 0, skipped: 0, failed: [] });
    const top = Array.from({ length: ROTATION_SLOTS.top }, (_, i) => ({
      id: `top/${i}`,
      source: 'r',
      slug: `${i}`,
      installs: 1,
    }));

    await runRotationPipeline({
      repository: {} as never,
      throttleMs: 0,
      maxSkills: 25,
      loadLeaderboardPage: async (view) => (view === 'all-time' ? top : []),
      loadOldest: async () => [],
      loadQueued: async () => Array.from({ length: 900 }, (_, i) => `queued/${i}`),
      scrape,
    });

    const call = scrape.mock.calls[0]?.[0] as { skillIds: string[] };
    expect(call.skillIds).toHaveLength(25);
    expect(call.skillIds.slice(0, ROTATION_SLOTS.top)).toEqual(top.map((skill) => skill.id));
  });

  it('reports nothing dropped when the queue fits', async () => {
    const scrape = vi.fn().mockResolvedValue({ attempted: 0, scraped: 0, skipped: 0, failed: [] });

    const result = await runRotationPipeline({
      repository: {} as never,
      throttleMs: 0,
      loadLeaderboardPage: async () => [],
      loadOldest: async () => [],
      loadQueued: async () => ['a', 'b'],
      scrape,
    });

    expect(result.selected).toBe(2);
    expect(result.dropped).toBe(0);
  });
});
