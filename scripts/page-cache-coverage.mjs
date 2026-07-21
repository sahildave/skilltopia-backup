#!/usr/bin/env node
/**
 * Field coverage report for cached skill page snapshots.
 *
 * Reads the public Backend (no Infisical): leaderboard top N, then batch page-cache.
 *
 *   MAX_ENRICHED=20 npm run page-cache:coverage
 *   MAX_ENRICHED=50 npm run page-cache:coverage
 *   MAX_ENRICHED=50 npm run page-cache:coverage -- --canvas
 *   SKILL_IDS=a/b/c,d/e/f npm run page-cache:coverage
 *
 * Env:
 *   MAX_ENRICHED          Cap (default 20; max 500 for this script's list page)
 *   SKILLS_PROXY_BASE_URL Backend origin (default https://skills-explorer-six.vercel.app)
 *   SKILL_IDS             Comma-separated ids (skips leaderboard)
 *   COVERAGE_CANVAS_PATH  Override canvas output path when using --canvas
 *
 * Flags:
 *   --json     JSON rows on stdout (default: TSV)
 *   --canvas   Also write a Cursor canvas beside the chat project
 *
 * Coverage tiers (source and repository are alternatives — either satisfies):
 *   Primary:   sourceOrRepo, summary, weeklyInstalls
 *   Secondary: skillMdPreview, installCommand
 *   Tertiary:  topics, related, stars, firstSeen
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const PRIMARY_KEYS = ['sourceOrRepo', 'summary', 'weeklyInstalls'];
const SECONDARY_KEYS = ['skillMdPreview', 'installCommand'];
const TERTIARY_KEYS = ['topics', 'related', 'stars', 'firstSeen'];
const COVERAGE_KEYS = [...PRIMARY_KEYS, ...SECONDARY_KEYS, ...TERTIARY_KEYS];

const TIER_BY_KEY = Object.fromEntries([
  ...PRIMARY_KEYS.map((key) => [key, 'primary']),
  ...SECONDARY_KEYS.map((key) => [key, 'secondary']),
  ...TERTIARY_KEYS.map((key) => [key, 'tertiary']),
]);

const DEFAULT_BASE = 'https://skills-explorer-six.vercel.app';
/** Keep in sync with api/_lib/query.ts PAGE_CACHE_BATCH_MAX. */
const PAGE_CACHE_BATCH_MAX = 100;
const DEFAULT_CANVAS = resolve(
  process.env.HOME ?? '',
  '.cursor/projects/Users-sahildave-code-projects-skills-explorer/canvases/scrape-field-coverage.canvas.tsx',
);
const MISSING = 'MISSING';

/** Mirror of api/_lib/skills-catalog skillPageUrl — keep in sync. */
function skillPageUrl(skillId, knownUrl) {
  const trimmed = typeof knownUrl === 'string' ? knownUrl.trim() : '';
  if (trimmed) return trimmed;
  const segments = skillId.split('/').filter(Boolean);
  if (segments.length === 2) {
    return `https://www.skills.sh/site/${skillId}`;
  }
  return `https://www.skills.sh/${skillId}`;
}

function parseArgs(argv) {
  return {
    json: argv.includes('--json'),
    canvas: argv.includes('--canvas'),
  };
}

function maxEnriched() {
  const raw = process.env.MAX_ENRICHED?.trim();
  if (!raw) return 20;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.min(n, 500);
}

function baseUrl() {
  return (process.env.SKILLS_PROXY_BASE_URL?.trim() || DEFAULT_BASE).replace(/\/$/u, '');
}

function canvasPath() {
  return process.env.COVERAGE_CANVAS_PATH?.trim() || DEFAULT_CANVAS;
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`${response.status} ${url}`);
  }
  return response.json();
}

async function loadSkillIds(limit) {
  const explicit = process.env.SKILL_IDS?.trim();
  if (explicit) {
    return explicit
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .slice(0, limit);
  }

  const ids = [];
  let page = 0;
  const perPage = Math.min(limit, 500);
  while (ids.length < limit) {
    const remaining = limit - ids.length;
    const take = Math.min(perPage, remaining);
    const url = `${baseUrl()}/api/skills?view=all-time&page=${page}&per_page=${take}`;
    const body = await fetchJson(url);
    const batch = body.data ?? [];
    if (batch.length === 0) break;
    for (const skill of batch) {
      if (skill?.id) ids.push(skill.id);
      if (ids.length >= limit) break;
    }
    if (batch.length < take) break;
    page += 1;
  }
  return ids;
}

function isBlank(value) {
  if (value === undefined || value === null) return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === 'string' && value.trim() === '') return true;
  return false;
}

function cellValue(key, snapshot) {
  if (!snapshot) return MISSING;
  const value = snapshot[key];
  if (isBlank(value)) return MISSING;
  if (key === 'topics' || key === 'related') {
    return Array.isArray(value) ? String(value.length) : MISSING;
  }
  if (key === 'weeklyInstalls') {
    return Array.isArray(value) ? String(value.length) : MISSING;
  }
  if (key === 'skillMdPreview') {
    return typeof value === 'string' && value.length > 0 ? `${value.length}ch` : MISSING;
  }
  if (key === 'summary' || key === 'installCommand' || key === 'source' || key === 'repository') {
    const text = String(value);
    return text.length > 48 ? `${text.slice(0, 45)}…` : text;
  }
  if (Array.isArray(value)) return String(value.length);
  return String(value);
}

/** Prefer source, else repository — either satisfies the primary slot. */
function sourceOrRepoCell(snapshot) {
  if (!snapshot) return MISSING;
  const source = cellValue('source', snapshot);
  if (source !== MISSING) return source;
  return cellValue('repository', snapshot);
}

function weeklyDays(snapshot) {
  const series = Array.isArray(snapshot?.weeklyInstalls) ? snapshot.weeklyInstalls.slice(0, 8) : [];
  return Array.from({ length: 8 }, (_, i) =>
    series[i] === undefined || series[i] === null ? MISSING : String(series[i]),
  );
}

function coverageCell(key, snapshot) {
  if (key === 'sourceOrRepo') return sourceOrRepoCell(snapshot);
  return cellValue(key, snapshot);
}

function missingCoverageKeys(snapshot) {
  if (!snapshot) return [...COVERAGE_KEYS];
  return COVERAGE_KEYS.filter((key) => coverageCell(key, snapshot) === MISSING);
}

function tierGap(missing, keys) {
  return keys.some((key) => missing.includes(key));
}

function rowToneFor(row) {
  if (row.hasPage !== 'yes') return 'danger';
  if (row.primaryGap) return 'danger';
  if (row.secondaryGap) return 'warning';
  return 'success';
}

function buildRow(skillId, cacheRow) {
  const data = cacheRow ?? {};
  const snapshot = data.pageSnapshot ?? null;
  const missing = missingCoverageKeys(snapshot);
  const days = weeklyDays(snapshot);
  const primaryGap = !snapshot || tierGap(missing, PRIMARY_KEYS);
  const secondaryGap = !snapshot || tierGap(missing, SECONDARY_KEYS);
  const tertiaryGap = !snapshot || tierGap(missing, TERTIARY_KEYS);
  return {
    skillId,
    pageUrl: skillPageUrl(skillId, data.sourceUrl),
    hasPage: snapshot ? 'yes' : 'NO',
    pageScrapedAt: data.pageScrapedAt ?? MISSING,
    sourceOrRepo: sourceOrRepoCell(snapshot),
    summary: cellValue('summary', snapshot),
    weeklyN: cellValue('weeklyInstalls', snapshot),
    d1: days[0],
    d2: days[1],
    d3: days[2],
    d4: days[3],
    d5: days[4],
    d6: days[5],
    d7: days[6],
    d8: days[7],
    skillMdPreview: cellValue('skillMdPreview', snapshot),
    installCommand: cellValue('installCommand', snapshot),
    topics: cellValue('topics', snapshot),
    related: cellValue('related', snapshot),
    stars: cellValue('stars', snapshot),
    firstSeen: cellValue('firstSeen', snapshot),
    primaryGap,
    secondaryGap,
    tertiaryGap,
    missingCount: missing.length,
    missingFields: missing.join(',') || '—',
  };
}

async function loadPageCaches(skillIds) {
  const rows = [];
  for (let offset = 0; offset < skillIds.length; offset += PAGE_CACHE_BATCH_MAX) {
    const chunk = skillIds.slice(offset, offset + PAGE_CACHE_BATCH_MAX);
    const batchNum = Math.floor(offset / PAGE_CACHE_BATCH_MAX) + 1;
    const batchTotal = Math.ceil(skillIds.length / PAGE_CACHE_BATCH_MAX);
    process.stderr.write(
      `[coverage] page-cache batch ${batchNum}/${batchTotal} (${chunk.length} id(s))\n`,
    );
    const params = new URLSearchParams({ skill_ids: chunk.join(',') });
    const body = await fetchJson(`${baseUrl()}/api/skills/page-cache?${params}`);
    const batch = body.data ?? [];
    if (!Array.isArray(batch) || batch.length !== chunk.length) {
      throw new Error(
        `page-cache batch size mismatch: expected ${chunk.length}, got ${Array.isArray(batch) ? batch.length : typeof batch}`,
      );
    }
    rows.push(...batch);
  }
  return rows;
}

const HEADERS = [
  'skill_id',
  'has_page',
  'page_scraped_at',
  'source_or_repo',
  'summary',
  'weekly_n',
  'd1',
  'd2',
  'd3',
  'd4',
  'd5',
  'd6',
  'd7',
  'd8',
  'skill_md_preview',
  'install_command',
  'topics',
  'related',
  'stars',
  'first_seen',
  'missing_count',
  'missing_fields',
  'page_url',
];

function rowToCells(row) {
  return [
    row.skillId,
    row.hasPage,
    row.pageScrapedAt,
    row.sourceOrRepo,
    row.summary,
    row.weeklyN,
    row.d1,
    row.d2,
    row.d3,
    row.d4,
    row.d5,
    row.d6,
    row.d7,
    row.d8,
    row.skillMdPreview,
    row.installCommand,
    row.topics,
    row.related,
    row.stars,
    row.firstSeen,
    String(row.missingCount),
    row.missingFields,
    row.pageUrl,
  ];
}

function cellForCoverageKey(row, key) {
  if (key === 'sourceOrRepo') return row.sourceOrRepo;
  if (key === 'weeklyInstalls') return row.weeklyN;
  if (key === 'skillMdPreview') return row.skillMdPreview;
  if (key === 'installCommand') return row.installCommand;
  if (key === 'firstSeen') return row.firstSeen;
  return row[key];
}

function fieldMissingCounts(rows) {
  const counts = Object.fromEntries(COVERAGE_KEYS.map((key) => [key, 0]));
  let noPage = 0;
  for (const row of rows) {
    if (row.hasPage !== 'yes') {
      noPage += 1;
      for (const key of COVERAGE_KEYS) counts[key] += 1;
      continue;
    }
    for (const key of COVERAGE_KEYS) {
      if (cellForCoverageKey(row, key) === MISSING) counts[key] += 1;
    }
  }
  return { counts, noPage };
}

function tierStats(rows) {
  const withPage = rows.filter((r) => r.hasPage === 'yes');
  return {
    primaryComplete: withPage.filter((r) => !r.primaryGap).length,
    secondaryComplete: withPage.filter((r) => !r.primaryGap && !r.secondaryGap).length,
    tertiaryComplete: withPage.filter((r) => !r.primaryGap && !r.secondaryGap && !r.tertiaryGap).length,
  };
}

function escapeTsx(value) {
  return JSON.stringify(value);
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const rank = (row) => {
      if (row.hasPage !== 'yes') return 3;
      if (row.primaryGap) return 2;
      if (row.secondaryGap) return 1;
      return 0;
    };
    return rank(b) - rank(a) || b.missingCount - a.missingCount || a.skillId.localeCompare(b.skillId);
  });
}

function writeCanvas(rows, limit) {
  const sorted = sortRows(rows);
  const { counts, noPage } = fieldMissingCounts(rows);
  const tiers = tierStats(rows);
  const generatedAt = new Date().toISOString();

  const tableHeaders = HEADERS.map((h) => escapeTsx(h)).join(', ');
  const tableRows = sorted
    .map((row) => {
      const cells = rowToCells(row).map((c) => escapeTsx(c)).join(', ');
      return `    [${cells}]`;
    })
    .join(',\n');

  const rowTone = sorted.map((row) => escapeTsx(rowToneFor(row))).join(', ');

  const missingStatsRows = COVERAGE_KEYS.map(
    (key) =>
      `    [${escapeTsx(TIER_BY_KEY[key])}, ${escapeTsx(key)}, ${escapeTsx(String(counts[key]))}, ${escapeTsx(String(rows.length - counts[key]))}]`,
  ).join(',\n');

  const source = `Source: ${baseUrl()} detail cache · top ${limit} all-time · ${generatedAt}`;
  const rerun = `MAX_ENRICHED=${limit} npm run page-cache:coverage -- --canvas`;
  const sampleLinks = sorted
    .slice(0, 8)
    .map((row) => `        <Link href={${escapeTsx(row.pageUrl)}}>${row.skillId}</Link>`)
    .join('\n');

  const contents = `import { Callout, Divider, Grid, H1, H2, Link, Stack, Stat, Table, Text } from 'cursor/canvas';

const SOURCE = ${escapeTsx(source)};
const RERUN = ${escapeTsx(rerun)};

export default function ScrapeFieldCoverage() {
  return (
    <Stack gap={20}>
      <H1>Scrape field coverage</H1>
      <Text tone="secondary">{SOURCE}</Text>
      <Text tone="tertiary">
        Re-run: <Text weight="medium">{RERUN}</Text>
      </Text>

      <Grid columns={5} gap={12}>
        <Stat value={${escapeTsx(String(rows.length))}} label="Skills checked" />
        <Stat value={${escapeTsx(String(tiers.primaryComplete))}} label="Primary complete" tone={${tiers.primaryComplete === rows.length ? '"success"' : '"danger"'}} />
        <Stat value={${escapeTsx(String(tiers.secondaryComplete))}} label="Secondary complete" tone={${tiers.secondaryComplete === rows.length ? '"success"' : '"warning"'}} />
        <Stat value={${escapeTsx(String(tiers.tertiaryComplete))}} label="All tiers complete" tone="success" />
        <Stat value={${escapeTsx(String(noPage))}} label="No page_snapshot" tone={${noPage > 0 ? '"danger"' : '"success"'}} />
      </Grid>

      <Callout tone="info" title="Coverage tiers">
        Primary: source/repo (either), summary, installs. Secondary: skillMdPreview, installCommand.
        Tertiary: topics, related, stars, firstSeen. Red = primary gap; yellow = secondary gap;
        tertiary-only gaps stay green. Open page_url — if skills.sh also lacks the section, the scraper is fine.
      </Callout>

      <H2>Missing count by field</H2>
      <Table
        headers={['tier', 'field', 'missing', 'present']}
        columnAlign={['left', 'left', 'right', 'right']}
        rows={[
${missingStatsRows}
        ]}
        striped
        stickyHeader
      />

      <Divider />

      <H2>Per-skill snapshot columns</H2>
      <Text tone="secondary">
        Columns are primary → secondary → tertiary. source_or_repo shows source if set, else repository.
        weekly_n is series length (expect 8); d1–d8 are install values in scraped order.
      </Text>
      <Table
        headers={[${tableHeaders}]}
        rows={[
${tableRows}
        ]}
        rowTone={[${rowTone}]}
        striped
        stickyHeader
      />

      <H2>Sample skills.sh links</H2>
      <Stack gap={6}>
${sampleLinks}
      </Stack>
    </Stack>
  );
}
`;

  const path = canvasPath();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, contents, 'utf8');
  return path;
}

function printTsv(rows) {
  const sorted = sortRows(rows);
  console.log(HEADERS.join('\t'));
  for (const row of sorted) {
    console.log(rowToCells(row).join('\t'));
  }
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const limit = maxEnriched();
  console.error(`[coverage] base=${baseUrl()} limit=${limit}`);

  const ids = await loadSkillIds(limit);
  console.error(`[coverage] loaded ${ids.length} skill id(s)`);

  const caches = await loadPageCaches(ids);
  const rows = ids.map((skillId, index) => buildRow(skillId, caches[index]));

  const { counts, noPage } = fieldMissingCounts(rows);
  const tiers = tierStats(rows);
  console.error(
    `[coverage] done checked=${rows.length} primary=${tiers.primaryComplete} secondary=${tiers.secondaryComplete} all_tiers=${tiers.tertiaryComplete} no_page=${noPage}`,
  );
  console.error(
    `[coverage] missing-by-field ${COVERAGE_KEYS.map((k) => `${k}=${counts[k]}`).join(' ')}`,
  );

  if (flags.canvas) {
    const path = writeCanvas(rows, limit);
    console.error(`[coverage] wrote canvas ${path}`);
  }

  if (flags.json) {
    console.log(JSON.stringify({ limit, base: baseUrl(), rows }, null, 2));
  } else {
    printTsv(rows);
  }

  if (tiers.primaryComplete < rows.length || noPage > 0) process.exitCode = 0; // gaps are informational
}

main().catch((error) => {
  console.error(`[coverage] ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
});
