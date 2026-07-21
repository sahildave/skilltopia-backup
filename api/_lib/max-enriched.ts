/** Shared leaderboard/enrich/scrape budget knob. */
export const MAX_ENRICHED = 500;

/** Reads `MAX_ENRICHED` from env; invalid/missing → default; always capped at `MAX_ENRICHED`. */
export function maxEnrichedFromEnv(environment = process.env): number {
  const raw = environment.MAX_ENRICHED?.trim();
  if (!raw) return MAX_ENRICHED;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return MAX_ENRICHED;
  return Math.min(parsed, MAX_ENRICHED);
}
