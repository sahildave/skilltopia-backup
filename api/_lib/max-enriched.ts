/** Hard ceiling for `MAX_ENRICHED` (full scrape sweep toward ~1500). */
export const MAX_ENRICHED = 1500;

/** Default when env unset (local enrich/scrape ramp). */
export const MAX_ENRICHED_DEFAULT = 500;

/**
 * Reads `MAX_ENRICHED` from env; invalid/missing → `MAX_ENRICHED_DEFAULT`;
 * always capped at `MAX_ENRICHED`.
 */
export function maxEnrichedFromEnv(environment = process.env): number {
  const raw = environment.MAX_ENRICHED?.trim();
  if (!raw) return MAX_ENRICHED_DEFAULT;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return MAX_ENRICHED_DEFAULT;
  return Math.min(parsed, MAX_ENRICHED);
}
