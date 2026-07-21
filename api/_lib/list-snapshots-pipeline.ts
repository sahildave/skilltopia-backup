import { fetchAllLeaderboard, type CatalogSkill, type LeaderboardView } from './skills-catalog.js';
import { createSupabaseRepositoryFromEnv, type SkillListSighting } from './supabase-repository.js';

type Repository = ReturnType<typeof createSupabaseRepositoryFromEnv>;

export type ListSnapshotsLogLevel = 'info' | 'ok' | 'warn' | 'error' | 'step';

export const LIST_SNAPSHOT_VIEWS: LeaderboardView[] = ['all-time', 'trending', 'hot'];

export type ListSnapshotsPipelineOptions = {
  repository: Repository;
  perPage?: number;
  snapshotDate?: Date;
  loadAllLeaderboard?: typeof fetchAllLeaderboard;
  log?: (message: string, level?: ListSnapshotsLogLevel) => void;
};

export type ListSnapshotsRunResult = {
  seen: number;
  queued: number;
  snapshots: number;
  views: Record<LeaderboardView, number>;
};

function utcDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function mergeByHighestInstalls(skills: CatalogSkill[]): CatalogSkill[] {
  const byId = new Map<string, CatalogSkill>();
  for (const skill of skills) {
    const previous = byId.get(skill.id);
    if (!previous || skill.installs > previous.installs) {
      byId.set(skill.id, skill);
    }
  }
  return [...byId.values()];
}

function toSightings(skills: CatalogSkill[]): SkillListSighting[] {
  return skills.map((skill) => ({
    skillId: skill.id,
    installCount: skill.installs,
    repository: skill.source,
    sourceUrl: skill.url,
  }));
}

export async function runListSnapshotsPipeline(
  options: ListSnapshotsPipelineOptions,
): Promise<ListSnapshotsRunResult> {
  const perPage = Math.min(Math.max(options.perPage ?? 500, 1), 500);
  const snapshotDate = options.snapshotDate ?? new Date();
  const date = utcDateString(snapshotDate);
  const loadAllLeaderboard = options.loadAllLeaderboard ?? fetchAllLeaderboard;
  const log = options.log ?? (() => {});
  const views: Record<LeaderboardView, number> = {
    'all-time': 0,
    trending: 0,
    hot: 0,
  };

  log(`start views=${LIST_SNAPSHOT_VIEWS.join(',')} perPage=${perPage} date=${date}`, 'info');

  const collected: CatalogSkill[] = [];
  for (const view of LIST_SNAPSHOT_VIEWS) {
    log(`fetching ${view} leaderboard…`, 'step');
    const skills = await loadAllLeaderboard(view, perPage);
    views[view] = skills.length;
    collected.push(...skills);
    log(`${view}: ${skills.length} skill(s)`, 'ok');
  }

  const merged = mergeByHighestInstalls(collected);
  log(`merged unique skills=${merged.length}`, 'info');

  log('syncing skill_metadata install counts…', 'step');
  const { queued } = await options.repository.syncListSkills(toSightings(merged));
  log(`queued new skills=${queued.length}`, queued.length > 0 ? 'warn' : 'ok');

  const snapshots = merged.map((skill) => ({
    skillId: skill.id,
    date,
    installs: skill.installs,
  }));
  log(`upserting ${snapshots.length} install snapshot(s) for ${date}…`, 'step');
  await options.repository.upsertInstallSnapshots(snapshots);

  const result: ListSnapshotsRunResult = {
    seen: merged.length,
    queued: queued.length,
    snapshots: snapshots.length,
    views,
  };
  log(`done seen=${result.seen} queued=${result.queued} snapshots=${result.snapshots}`, 'ok');
  return result;
}

type LocalListSnapshotsOptions = Omit<ListSnapshotsPipelineOptions, 'repository'> &
  Partial<Pick<ListSnapshotsPipelineOptions, 'repository'>>;

export async function runLocalListSnapshots(
  options: LocalListSnapshotsOptions = {},
): Promise<ListSnapshotsRunResult> {
  return runListSnapshotsPipeline({
    repository: options.repository ?? createSupabaseRepositoryFromEnv(),
    ...options,
  });
}
