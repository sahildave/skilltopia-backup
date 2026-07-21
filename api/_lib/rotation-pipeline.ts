import { ROTATION_SLOT_TOTAL, ROTATION_SLOTS, selectRotationIds } from './rotation-select.js';
import {
  runScrapePipeline,
  type ScrapeLogLevel,
  type ScrapePipelineOptions,
  type ScrapeRunResult,
} from './scrape-pipeline.js';
import { fetchLeaderboardPage, type CatalogSkill, type LeaderboardView } from './skills-catalog.js';
import { createSupabaseRepositoryFromEnv } from './supabase-repository.js';

type Repository = ReturnType<typeof createSupabaseRepositoryFromEnv>;

export type RotationLogLevel = ScrapeLogLevel;

export type RotationPipelineOptions = {
  repository: Repository;
  /** Default 1000ms keeps detail+audit under ~120 OIDC req/min (≪ 600). */
  throttleMs?: number;
  scrapeDate?: Date;
  /** Extra buffer when loading list slots so overlaps can be replaced. */
  listFetchSize?: number;
  /** Extra buffer for oldest query after list-slot overlaps. */
  oldestFetchSize?: number;
  loadLeaderboardPage?: typeof fetchLeaderboardPage;
  loadOldest?: (limit: number) => Promise<string[]>;
  loadQueued?: (limit: number) => Promise<string[]>;
  /** Extra queued ids from a just-finished list pass. */
  extraQueued?: string[];
  scrape?: typeof runScrapePipeline;
  loadDetail?: ScrapePipelineOptions['loadDetail'];
  loadAudits?: ScrapePipelineOptions['loadAudits'];
  fetchPageHtml?: ScrapePipelineOptions['fetchPageHtml'];
  sleep?: (milliseconds: number) => Promise<void>;
  log?: (message: string, level?: RotationLogLevel) => void;
};

export type RotationRunResult = ScrapeRunResult & {
  selected: number;
  queuedExtra: number;
  slots: typeof ROTATION_SLOTS;
};

function idsFrom(skills: CatalogSkill[]): string[] {
  return skills.map((skill) => skill.id);
}

export async function runRotationPipeline(
  options: RotationPipelineOptions,
): Promise<RotationRunResult> {
  const throttleMs = options.throttleMs ?? 1000;
  const listFetchSize = options.listFetchSize ?? 50;
  const oldestFetchSize = options.oldestFetchSize ?? ROTATION_SLOTS.oldest + 80;
  const loadLeaderboardPage = options.loadLeaderboardPage ?? fetchLeaderboardPage;
  const log = options.log ?? (() => {});
  const scrape = options.scrape ?? runScrapePipeline;

  const loadOldest =
    options.loadOldest ?? ((limit) => options.repository.listOldestPageScraped(limit));
  const loadQueued =
    options.loadQueued ?? ((limit) => options.repository.listQueuedDetailSkills(limit));

  log(
    `start slots=top${ROTATION_SLOTS.top}+hot${ROTATION_SLOTS.hot}+trending${ROTATION_SLOTS.trending}+oldest${ROTATION_SLOTS.oldest} throttleMs=${throttleMs}`,
    'info',
  );

  async function loadView(view: LeaderboardView, take: number): Promise<string[]> {
    log(`fetching ${view} (up to ${take})…`, 'step');
    const skills = await loadLeaderboardPage(view, 0, Math.max(take, listFetchSize));
    log(`${view}: ${skills.length} skill(s)`, 'ok');
    return idsFrom(skills);
  }

  const [top, hot, trending, oldest, queuedFromDb] = await Promise.all([
    loadView('all-time', ROTATION_SLOTS.top),
    loadView('hot', ROTATION_SLOTS.hot),
    loadView('trending', ROTATION_SLOTS.trending),
    loadOldest(oldestFetchSize),
    loadQueued(500),
  ]);

  const queued = [...(options.extraQueued ?? []), ...queuedFromDb];
  const skillIds = selectRotationIds({ top, hot, trending, oldest, queued });
  const queuedExtra = Math.max(0, skillIds.length - ROTATION_SLOT_TOTAL);
  log(`selected ${skillIds.length} skill(s) (queued extras=${queuedExtra})`, 'ok');

  const scrapeResult = await scrape({
    repository: options.repository,
    skillIds,
    maxEnriched: skillIds.length,
    throttleMs,
    scrapeDate: options.scrapeDate,
    loadDetail: options.loadDetail,
    loadAudits: options.loadAudits,
    fetchPageHtml: options.fetchPageHtml,
    sleep: options.sleep,
    log,
  });

  return {
    ...scrapeResult,
    selected: skillIds.length,
    queuedExtra,
    slots: ROTATION_SLOTS,
  };
}

type LocalRotationOptions = Omit<RotationPipelineOptions, 'repository'> &
  Partial<Pick<RotationPipelineOptions, 'repository'>>;

export async function runLocalRotation(
  options: LocalRotationOptions = {},
): Promise<RotationRunResult> {
  return runRotationPipeline({
    repository: options.repository ?? createSupabaseRepositoryFromEnv(),
    ...options,
  });
}
