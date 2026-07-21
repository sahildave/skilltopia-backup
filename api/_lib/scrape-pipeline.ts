import { maxEnrichedFromEnv, MAX_ENRICHED, MAX_ENRICHED_DEFAULT } from './max-enriched.js';
import { refreshSkillAuditsIfNeeded } from './audit-cache.js';
import { mapWeeklyInstallsToDates, parsePageSnapshot } from './page-snapshot.js';
import {
  fetchLeaderboard,
  fetchSkillAudits,
  fetchSkillDetail,
  type SkillDetail,
} from './skills-catalog.js';
import {
  createSupabaseRepositoryFromEnv,
  type SkillSourceMetadata,
} from './supabase-repository.js';

type Repository = ReturnType<typeof createSupabaseRepositoryFromEnv>;
export type ScrapeLogLevel = 'info' | 'ok' | 'warn' | 'error' | 'step';

export type ScrapePipelineOptions = {
  repository: Repository;
  maxEnriched?: number;
  /** When set, scrape these ids instead of loading the leaderboard slice. */
  skillIds?: string[];
  throttleMs?: number;
  scrapeDate?: Date;
  loadLeaderboard?: typeof fetchLeaderboard;
  loadDetail?: typeof fetchSkillDetail;
  loadAudits?: typeof fetchSkillAudits;
  fetchPageHtml?: (url: string) => Promise<string>;
  sleep?: (milliseconds: number) => Promise<void>;
  log?: (message: string, level?: ScrapeLogLevel) => void;
};

export type ScrapeRunResult = {
  attempted: number;
  scraped: number;
  skipped: number;
  failed: Array<{ skillId: string; message: string }>;
};

function sourceMetadata(detail: SkillDetail): SkillSourceMetadata {
  return {
    skillId: detail.id,
    contentHash: detail.hash ?? '',
    sourceUrl: detail.url,
    repository: detail.source,
    installCount: detail.installs,
    rawStoragePrefix: detail.id,
  };
}

function pageUrl(detail: SkillDetail): string {
  if (detail.url?.trim()) return detail.url.trim();
  return `https://skills.sh/${detail.id}`;
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

export async function runScrapePipeline(options: ScrapePipelineOptions): Promise<ScrapeRunResult> {
  const maxEnriched = Math.min(options.maxEnriched ?? MAX_ENRICHED_DEFAULT, MAX_ENRICHED);
  const throttleMs = options.throttleMs ?? 1000;
  const scrapeDate = options.scrapeDate ?? new Date();
  const sleep = options.sleep ?? (async (ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const loadLeaderboard = options.loadLeaderboard ?? fetchLeaderboard;
  const loadDetail = options.loadDetail ?? fetchSkillDetail;
  const loadAudits = options.loadAudits ?? fetchSkillAudits;
  const fetchPageHtml = options.fetchPageHtml ?? fetchSkillsShHtml;
  const log = options.log ?? (() => {});
  const result: ScrapeRunResult = {
    attempted: 0,
    scraped: 0,
    skipped: 0,
    failed: [],
  };

  const explicitIds = options.skillIds;
  log(
    `start maxEnriched=${maxEnriched} throttleMs=${throttleMs} mode=${explicitIds ? 'ids' : 'leaderboard'}`,
    'info',
  );

  let skillIds: string[];
  if (explicitIds) {
    skillIds = explicitIds.slice(0, maxEnriched);
    log(`using ${skillIds.length} explicit skill id(s)`, 'ok');
  } else {
    log('fetching leaderboard from skills.sh…', 'step');
    skillIds = (await loadLeaderboard(maxEnriched)).slice(0, maxEnriched).map((skill) => skill.id);
    log(`leaderboard returned ${skillIds.length} skill(s)`, 'ok');
  }

  for (const [index, skillId] of skillIds.entries()) {
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

      const source = sourceMetadata(detail);
      log(`${step}: upserting metadata…`, 'step');
      const previousCache = await options.repository.getSkillAuditCache(detail.id);
      await options.repository.upsertSkillMetadata(source);

      try {
        log(`${step}: refreshing audits if needed…`, 'step');
        const auditResult = await refreshSkillAuditsIfNeeded({
          skillId: detail.id,
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

      const url = pageUrl(detail);
      let snapshot = null;
      try {
        log(`${step}: scraping HTML…`, 'step');
        const html = await scrapeWithRetry(fetchPageHtml, url);
        snapshot = parsePageSnapshot(html);
        await options.repository.upsertPageSnapshot(detail.id, snapshot, scrapeDate.toISOString());
        result.scraped += 1;
        log(`${step}: scraped`, 'ok');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // Clear stale snapshot so rotation can retry; metadata/hash already saved.
        await options.repository.upsertPageSnapshot(detail.id, null, scrapeDate.toISOString());
        result.failed.push({ skillId, message });
        log(`${step}: scrape failed after retry — ${message}`, 'error');
      }

      const weekly = snapshot?.weeklyInstalls;
      if (weekly && weekly.length > 0) {
        const existing = await options.repository.countInstallSnapshots(detail.id);
        if (existing < 8) {
          log(`${step}: backfilling ${weekly.length} install snapshot(s)…`, 'step');
          await options.repository.upsertInstallSnapshots(
            mapWeeklyInstallsToDates(weekly, detail.id, scrapeDate),
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

    if (throttleMs > 0) {
      log(`${step}: throttling ${throttleMs}ms…`, 'step');
      await sleep(throttleMs);
    }
  }

  log(
    `done attempted=${result.attempted} scraped=${result.scraped} skipped=${result.skipped} failed=${result.failed.length}`,
    result.failed.length > 0 ? 'warn' : 'ok',
  );
  return result;
}

type LocalScrapeOptions = Omit<ScrapePipelineOptions, 'repository'> &
  Partial<Pick<ScrapePipelineOptions, 'repository'>>;

export async function runLocalScrape(options: LocalScrapeOptions = {}): Promise<ScrapeRunResult> {
  return runScrapePipeline({
    repository: options.repository ?? createSupabaseRepositoryFromEnv(),
    ...options,
    maxEnriched: options.maxEnriched ?? maxEnrichedFromEnv(),
  });
}
