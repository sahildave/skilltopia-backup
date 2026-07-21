import { maxEnrichedFromEnv, MAX_ENRICHED, MAX_ENRICHED_DEFAULT } from './max-enriched.js';
import { refreshSkillAuditsIfNeeded } from './audit-cache.js';
import { mapWeeklyInstallsToDates, parsePageSnapshot } from './page-snapshot.js';
import {
  fetchLeaderboard,
  fetchSkillAudits,
  fetchSkillDetail,
  classifySkillOrigin,
  skillPageUrl,
  type SkillDetail,
} from './skills-catalog.js';
import {
  createSupabaseRepositoryFromEnv,
  type SkillSourceMetadata,
} from './supabase-repository.js';
import { throttleMsFromEnv, THROTTLE_MS_DEFAULT } from './throttle-ms.js';

type Repository = ReturnType<typeof createSupabaseRepositoryFromEnv>;
export type ScrapeLogLevel = 'info' | 'ok' | 'warn' | 'error' | 'step';

/** Chunk size for `listSkillPageCaches` lookups (Supabase `.in` limit headroom). */
const PAGE_CACHE_LOOKUP_CHUNK = 200;

export type ScrapePipelineOptions = {
  repository: Repository;
  maxEnriched?: number;
  /** When set, scrape these ids instead of loading the leaderboard slice. */
  skillIds?: string[];
  throttleMs?: number;
  /**
   * When true, drop ids that already have a non-null `page_snapshot` before
   * scraping. For one-shot sweeps only — daily rotation must leave this false.
   */
  skipCached?: boolean;
  scrapeDate?: Date;
  signal?: AbortSignal;
  loadLeaderboard?: typeof fetchLeaderboard;
  loadDetail?: typeof fetchSkillDetail;
  loadAudits?: typeof fetchSkillAudits;
  fetchPageHtml?: (url: string) => Promise<string>;
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
  log?: (message: string, level?: ScrapeLogLevel) => void;
};

export type ScrapeRunResult = {
  attempted: number;
  scraped: number;
  skipped: number;
  /** Ids dropped up front because `page_snapshot` already exists (`skipCached`). */
  cachedSkipped: number;
  failed: Array<{ skillId: string; message: string }>;
  aborted?: boolean;
};

/** Comma-separated `SKILL_IDS` env → list, or undefined when unset. */
export function skillIdsFromEnv(environment = process.env): string[] | undefined {
  const raw = environment.SKILL_IDS?.trim();
  if (!raw) return undefined;
  const ids = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  return ids.length > 0 ? ids : undefined;
}

/** `SCRAPE_SKIP_CACHED=1|true|yes` → skip ids that already have `page_snapshot`. */
export function scrapeSkipCachedFromEnv(
  environment: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  const raw = environment.SCRAPE_SKIP_CACHED?.trim().toLowerCase();
  if (!raw) return false;
  return raw === '1' || raw === 'true' || raw === 'yes';
}

async function filterUncachedSkillIds(
  repository: Repository,
  skillIds: string[],
): Promise<{ pending: string[]; cachedSkipped: number }> {
  const cachedIds = new Set<string>();
  for (let offset = 0; offset < skillIds.length; offset += PAGE_CACHE_LOOKUP_CHUNK) {
    const chunk = skillIds.slice(offset, offset + PAGE_CACHE_LOOKUP_CHUNK);
    const rows = await repository.listSkillPageCaches(chunk);
    for (const row of rows) {
      if (row.pageSnapshot != null) cachedIds.add(row.skillId);
    }
  }
  const pending = skillIds.filter((id) => !cachedIds.has(id));
  return { pending, cachedSkipped: skillIds.length - pending.length };
}

/**
 * Build metadata for the *requested* catalog id.
 * skills.sh detail sometimes returns a mangled `id` (e.g. strips `:` from
 * `react:components` → `reactcomponents`); never write under that mangled id.
 */
function sourceMetadata(
  skillId: string,
  detail: SkillDetail,
  existingInstallCount?: number | null,
): SkillSourceMetadata {
  const origin = classifySkillOrigin(skillId, detail.source);
  const detailIdMismatched = detail.id !== skillId;
  return {
    skillId,
    contentHash: detail.hash ?? '',
    sourceUrl: skillPageUrl(skillId, detail.url),
    repository: origin.repository,
    source: origin.source,
    installCount: detailIdMismatched ? (existingInstallCount ?? detail.installs) : detail.installs,
    rawStoragePrefix: skillId,
  };
}

async function fetchSkillsShHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { Accept: 'text/html', 'User-Agent': 'skills-explorer-scrape/1.0' },
  });
  if (!response.ok) throw new Error(`skills.sh HTML fetch failed: ${response.status}`);
  return response.text();
}

async function scrapeWithRetry(
  fetchPageHtml: (url: string) => Promise<string>,
  url: string,
): Promise<string> {
  try {
    return await fetchPageHtml(url);
  } catch {
    return await fetchPageHtml(url);
  }
}

function defaultSleep(milliseconds: number, signal?: AbortSignal): Promise<void> {
  if (!signal) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }
  if (signal.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, milliseconds);
    signal.addEventListener('abort', onAbort, { once: true });
  });
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof Error && error.name === 'AbortError') ||
    (typeof DOMException !== 'undefined' &&
      error instanceof DOMException &&
      error.name === 'AbortError')
  );
}

export async function runScrapePipeline(options: ScrapePipelineOptions): Promise<ScrapeRunResult> {
  const maxEnriched = Math.min(options.maxEnriched ?? MAX_ENRICHED_DEFAULT, MAX_ENRICHED);
  const throttleMs = options.throttleMs ?? THROTTLE_MS_DEFAULT;
  const skipCached = options.skipCached ?? false;
  const scrapeDate = options.scrapeDate ?? new Date();
  const signal = options.signal;
  const sleep = options.sleep ?? defaultSleep;
  const loadLeaderboard = options.loadLeaderboard ?? fetchLeaderboard;
  const loadDetail = options.loadDetail ?? fetchSkillDetail;
  const loadAudits = options.loadAudits ?? fetchSkillAudits;
  const fetchPageHtml = options.fetchPageHtml ?? fetchSkillsShHtml;
  const log = options.log ?? (() => {});
  const result: ScrapeRunResult = {
    attempted: 0,
    scraped: 0,
    skipped: 0,
    cachedSkipped: 0,
    failed: [],
  };

  const explicitIds = options.skillIds;
  log(
    `start maxEnriched=${maxEnriched} throttleMs=${throttleMs} skipCached=${skipCached ? 1 : 0} mode=${explicitIds ? 'ids' : 'leaderboard'}`,
    'info',
  );

  let skillIds: string[];
  if (explicitIds) {
    // Explicit list ignores MAX_ENRICHED default; still hard-capped.
    skillIds = explicitIds.slice(0, MAX_ENRICHED);
    log(`using ${skillIds.length} explicit skill id(s)`, 'ok');
  } else {
    log('fetching leaderboard from skills.sh…', 'step');
    skillIds = (await loadLeaderboard(maxEnriched)).slice(0, maxEnriched).map((skill) => skill.id);
    log(`leaderboard returned ${skillIds.length} skill(s)`, 'ok');
  }

  if (skipCached && skillIds.length > 0) {
    log(`filtering ${skillIds.length} id(s) against existing page_snapshot…`, 'step');
    const filtered = await filterUncachedSkillIds(options.repository, skillIds);
    result.cachedSkipped = filtered.cachedSkipped;
    skillIds = filtered.pending;
    log(`skipCached: ${result.cachedSkipped} already cached · ${skillIds.length} remaining`, 'ok');
  }

  for (const [index, skillId] of skillIds.entries()) {
    if (signal?.aborted) {
      result.aborted = true;
      log(`aborted before ${skillId} (${index}/${skillIds.length} done)`, 'warn');
      break;
    }

    const step = `[${index + 1}/${skillIds.length}] ${skillId}`;
    result.attempted += 1;
    try {
      log(`${step}: fetching detail…`, 'step');
      const detail = await loadDetail(skillId);
      if (!detail.hash) {
        result.skipped += 1;
        log(`${step}: skipped (null hash)`, 'warn');
        continue;
      }

      if (detail.id !== skillId) {
        log(
          `${step}: detail id mismatch (api=${detail.id}); keeping requested id for writes`,
          'warn',
        );
      }

      const previousPage = await options.repository.getSkillPageCache(skillId);
      const source = sourceMetadata(skillId, detail, previousPage?.installCount);
      log(`${step}: upserting metadata…`, 'step');
      const previousCache = await options.repository.getSkillAuditCache(skillId);
      await options.repository.upsertSkillMetadata(source);

      try {
        log(`${step}: refreshing audits if needed…`, 'step');
        const auditResult = await refreshSkillAuditsIfNeeded({
          skillId,
          currentHash: detail.hash,
          previousContentHash: previousCache?.contentHash ?? null,
          cached: previousCache,
          repository: options.repository,
          fetchAudits: loadAudits,
          now: scrapeDate.getTime(),
        });
        if (auditResult.refreshed) {
          log(`${step}: audits refreshed`, 'ok');
        } else {
          log(`${step}: audits cache fresh`, 'ok');
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`${step}: audit refresh failed — ${message}`, 'warn');
      }

      const url = skillPageUrl(
        skillId,
        detail.id === skillId ? detail.url : (previousPage?.sourceUrl ?? detail.url),
      );
      let snapshot = null;
      try {
        log(`${step}: scraping HTML ${url}…`, 'step');
        const html = await scrapeWithRetry(fetchPageHtml, url);
        snapshot = parsePageSnapshot(html);
        await options.repository.upsertPageSnapshot(skillId, snapshot, scrapeDate.toISOString());
        result.scraped += 1;
        log(`${step}: scraped`, 'ok');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Clear stale snapshot so rotation can retry; metadata/hash already saved.
        await options.repository.upsertPageSnapshot(skillId, null, scrapeDate.toISOString());
        result.failed.push({ skillId, message });
        log(`${step}: scrape failed after retry — ${message}`, 'error');
      }

      const weekly = snapshot?.weeklyInstalls;
      if (weekly && weekly.length > 0) {
        const existing = await options.repository.countInstallSnapshots(skillId);
        if (existing < 8) {
          log(`${step}: backfilling ${weekly.length} install snapshot(s)…`, 'step');
          await options.repository.upsertInstallSnapshots(
            mapWeeklyInstallsToDates(weekly, skillId, scrapeDate),
          );
        } else {
          log(`${step}: skip install backfill (have ${existing} rows)`, 'warn');
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      result.failed.push({ skillId, message });
      log(`${step}: failed — ${message}`, 'error');
    }

    if (throttleMs > 0 && index < skillIds.length - 1) {
      log(`${step}: throttling ${throttleMs}ms…`, 'step');
      try {
        await sleep(throttleMs, signal);
      } catch (error) {
        if (isAbortError(error) || signal?.aborted) {
          result.aborted = true;
          log('aborted during throttle', 'warn');
          break;
        }
        throw error;
      }
    }
  }

  log(
    `done attempted=${result.attempted} scraped=${result.scraped} skipped=${result.skipped} cachedSkipped=${result.cachedSkipped} failed=${result.failed.length}${result.aborted ? ' aborted=1' : ''}`,
    result.failed.length > 0 || result.aborted ? 'warn' : 'ok',
  );
  return result;
}

type LocalScrapeOptions = Omit<ScrapePipelineOptions, 'repository'> &
  Partial<Pick<ScrapePipelineOptions, 'repository'>>;

export async function runLocalScrape(options: LocalScrapeOptions = {}): Promise<ScrapeRunResult> {
  return runScrapePipeline({
    repository: options.repository ?? createSupabaseRepositoryFromEnv(),
    ...options,
    skillIds: options.skillIds ?? skillIdsFromEnv(),
    maxEnriched: options.maxEnriched ?? maxEnrichedFromEnv(),
    throttleMs: options.throttleMs ?? throttleMsFromEnv(),
    skipCached: options.skipCached ?? scrapeSkipCachedFromEnv(),
  });
}
