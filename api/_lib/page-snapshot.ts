import type { SkillInstallSnapshotRecord, SkillPageSnapshot } from './supabase-repository.js';

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/giu, '&')
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&quot;/giu, '"')
    .replace(/&#x27;/giu, "'")
    .replace(/&#39;/giu, "'");
}

function stripTags(html: string): string {
  return decodeEntities(
    html
      .replace(/<[^>]+>/gu, ' ')
      .replace(/\s+/gu, ' ')
      .trim(),
  );
}

/** Parses compact display counts like `162.7K` / `1.2M`. */
export function parseCompactCount(raw: string): number | undefined {
  const match = raw.trim().match(/^([\d.]+)\s*([KMB])?$/iu);
  if (!match) return undefined;
  const base = Number.parseFloat(match[1] ?? '');
  if (!Number.isFinite(base)) return undefined;
  const suffix = (match[2] ?? '').toUpperCase();
  const factor =
    suffix === 'K' ? 1_000 : suffix === 'M' ? 1_000_000 : suffix === 'B' ? 1_000_000_000 : 1;
  return Math.round(base * factor);
}

function parseWeeklyFromAria(html: string): number[] | undefined {
  const match = html.match(/aria-label="Weekly installs:\s*([^"]+)"/iu);
  if (!match?.[1]) return undefined;
  const values = [...match[1].matchAll(/\d{1,3}(?:,\d{3})+|\d+/gu)].map((m) =>
    Number.parseInt(m[0].replace(/,/gu, ''), 10),
  );
  return values.length > 0 ? values : undefined;
}

function parseWeeklyFromRsc(html: string): number[] | undefined {
  const match = html.match(/\\*"values\\*"\s*:\s*\[([^\]]+)\]/u);
  if (!match?.[1]) return undefined;
  const values = match[1]
    .split(',')
    .map((part) => Number.parseInt(part.trim(), 10))
    .filter((value) => Number.isFinite(value));
  return values.length > 0 ? values : undefined;
}

function parseTopics(html: string): string[] | undefined {
  const chipBlock =
    html.match(/<h1[\s\S]*?<div class="flex flex-wrap[^"]*"[^>]*>([\s\S]*?)<\/div>/iu)?.[1] ?? '';
  const topics = [...chipBlock.matchAll(/href="\/topic\/[^"]+"[^>]*>([^<]+)</giu)]
    .map((match) => decodeEntities(match[1]?.trim() ?? ''))
    .filter(Boolean);
  return topics.length > 0 ? [...new Set(topics)] : undefined;
}

function parseRelated(html: string): unknown[] | undefined {
  const section = html.match(/Related skills[\s\S]*?<ul[^>]*>([\s\S]*?)<\/ul>/iu)?.[1];
  if (!section) return undefined;
  const related = [
    ...section.matchAll(
      /href="\/([^"]+)"[\s\S]*?<h3[^>]*>([^<]*)<\/h3>(?:[\s\S]*?<p[^>]*>([^<]*)<\/p>)?/giu,
    ),
  ]
    .map((match) => {
      const rawId = match[1]?.trim();
      const id = rawId?.replace(/^site\//u, '');
      const name = decodeEntities(match[2]?.trim() ?? '');
      const description = decodeEntities(match[3]?.trim() ?? '');
      if (!id) return null;
      return {
        id,
        ...(name ? { name } : {}),
        ...(description ? { description } : {}),
      };
    })
    .filter(Boolean);
  return related.length > 0 ? related : undefined;
}

/**
 * Sparse HTML → `SkillPageSnapshot`. Missing sections stay omitted.
 * Weekly series prefers sparkline `aria-label`, falls back to RSC `"values":[...]`.
 */
export function parsePageSnapshot(html: string): SkillPageSnapshot {
  if (!html.trim()) return {};

  const snapshot: SkillPageSnapshot = {};

  const summaryStrong = html.match(/>Summary<\/[^>]*>[\s\S]*?<strong>([^<]+)<\/strong>/iu)?.[1];
  const summaryLd = html.match(/"description"\s*:\s*"((?:\\.|[^"\\])*)"/u)?.[1];
  const summary = summaryStrong
    ? decodeEntities(summaryStrong.trim())
    : summaryLd
      ? decodeEntities(summaryLd.replace(/\\"/gu, '"').replace(/\\n/gu, ' ').trim())
      : undefined;
  if (summary) snapshot.summary = summary;

  const topics = parseTopics(html);
  if (topics) snapshot.topics = topics;

  const repository =
    html.match(
      />Repository[\s\S]*?href="https:\/\/github\.com\/[^"]+"[^>]*title="([^"]+)"/iu,
    )?.[1] ?? html.match(/>Repository[\s\S]*?href="https:\/\/github\.com\/([^"]+)"/iu)?.[1];
  if (repository && !/verified/iu.test(repository)) {
    snapshot.repository = decodeEntities(repository.trim());
  }

  const sourceHref =
    html.match(/>Source[\s\S]*?href="(https?:\/\/[^"]+)"/iu)?.[1] ??
    html.match(/>Source[\s\S]*?href="([^"]+)"/iu)?.[1];
  if (sourceHref && !/verified/iu.test(sourceHref) && !/skills\.sh\//iu.test(sourceHref)) {
    snapshot.source = decodeEntities(sourceHref.trim());
  }

  const starsRaw = html.match(/>GitHub Stars<\/span>[\s\S]*?<span>([^<]+)<\/span>/iu)?.[1];
  const stars = starsRaw ? parseCompactCount(starsRaw) : undefined;
  if (stars !== undefined) snapshot.stars = stars;

  const firstSeen = html.match(/>First Seen<\/span>[\s\S]*?<div[^>]*>([^<]+)<\/div>/iu)?.[1];
  if (firstSeen?.trim()) snapshot.firstSeen = decodeEntities(firstSeen.trim());

  const installCommand = html.match(/npx skills add [^<"']+/iu)?.[0];
  if (installCommand) snapshot.installCommand = installCommand.trim();

  const weeklyInstalls = parseWeeklyFromAria(html) ?? parseWeeklyFromRsc(html);
  if (weeklyInstalls) snapshot.weeklyInstalls = weeklyInstalls;

  const skillMdBlock = html.match(
    />SKILL\.md<\/span>[\s\S]*?<div class="prose[^"]*"[^>]*>([\s\S]*?)<\/div>/iu,
  )?.[1];
  if (skillMdBlock) {
    const preview = stripTags(skillMdBlock).slice(0, 2_000);
    if (preview) snapshot.skillMdPreview = preview;
  }

  const related = parseRelated(html);
  if (related) snapshot.related = related;

  return snapshot;
}

/** Map scraped weekly series onto the last 8 UTC calendar days ending on `scrapeDate`. */
export function mapWeeklyInstallsToDates(
  values: number[],
  skillId: string,
  scrapeDate: Date,
): SkillInstallSnapshotRecord[] {
  const series = values.slice(0, 8);
  const year = scrapeDate.getUTCFullYear();
  const month = scrapeDate.getUTCMonth();
  const day = scrapeDate.getUTCDate();

  return series.map((installs, index) => {
    const offset = 7 - index;
    const date = new Date(Date.UTC(year, month, day - offset));
    const iso = date.toISOString().slice(0, 10);
    return { skillId, date: iso, installs };
  });
}

/** Prefer scraped weekly series; else last 8 `skill_install_snapshots` by date. */
export function resolveInstallSeries(
  weeklyInstalls: number[] | undefined,
  snapshots: SkillInstallSnapshotRecord[],
): number[] {
  if (weeklyInstalls && weeklyInstalls.length > 0) {
    return weeklyInstalls.slice(0, 8);
  }
  if (snapshots.length === 0) return [];
  return [...snapshots]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-8)
    .map((row) => row.installs);
}
