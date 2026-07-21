import { describe, expect, it, vi } from 'vitest';
import { runListSnapshotsPipeline } from './list-snapshots-pipeline.js';
import type { CatalogSkill } from './skills-catalog.js';

function skill(id: string, installs: number, viewTag = ''): CatalogSkill {
  return {
    id,
    source: `${id}-repo`,
    slug: id.split('/')[1] ?? id,
    installs,
    url: `https://skills.sh/${id}${viewTag}`,
  };
}

describe('list snapshots pipeline', () => {
  it('merges three views, upserts installs + daily snapshots, queues new skills only', async () => {
    const syncListSkills = vi.fn().mockResolvedValue({ queued: ['new/skill'] });
    const upsertInstallSnapshots = vi.fn();
    const loadAllLeaderboard = vi.fn(async (view: string) => {
      if (view === 'all-time') return [skill('top/skill', 100), skill('shared/skill', 50)];
      if (view === 'trending') return [skill('shared/skill', 55), skill('new/skill', 10)];
      return [skill('hot/skill', 20)];
    });

    await expect(
      runListSnapshotsPipeline({
        repository: { syncListSkills, upsertInstallSnapshots } as never,
        snapshotDate: new Date('2026-07-21T15:00:00.000Z'),
        loadAllLeaderboard,
      }),
    ).resolves.toMatchObject({
      seen: 4,
      queued: 1,
      snapshots: 4,
    });

    expect(loadAllLeaderboard).toHaveBeenCalledTimes(3);
    expect(syncListSkills).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ skillId: 'shared/skill', installCount: 55 }),
        expect.objectContaining({ skillId: 'new/skill', installCount: 10 }),
      ]),
    );
    expect(upsertInstallSnapshots).toHaveBeenCalledWith(
      expect.arrayContaining([
        { skillId: 'shared/skill', date: '2026-07-21', installs: 55 },
        { skillId: 'new/skill', date: '2026-07-21', installs: 10 },
      ]),
    );
  });

  it('is idempotent for the same calendar day (re-upsert same PK rows)', async () => {
    const syncListSkills = vi.fn().mockResolvedValue({ queued: [] });
    const upsertInstallSnapshots = vi.fn();
    const loadAllLeaderboard = vi.fn(async () => [skill('top/skill', 100)]);

    const options = {
      repository: { syncListSkills, upsertInstallSnapshots } as never,
      snapshotDate: new Date('2026-07-21T01:00:00.000Z'),
      loadAllLeaderboard,
    };

    await runListSnapshotsPipeline(options);
    await runListSnapshotsPipeline(options);

    expect(upsertInstallSnapshots).toHaveBeenCalledTimes(2);
    expect(upsertInstallSnapshots.mock.calls[0][0]).toEqual([
      { skillId: 'top/skill', date: '2026-07-21', installs: 100 },
    ]);
    expect(upsertInstallSnapshots.mock.calls[1][0]).toEqual(
      upsertInstallSnapshots.mock.calls[0][0],
    );
  });
});
