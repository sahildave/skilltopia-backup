/**
 * Full corpus scrape toward ~1500.
 * Sweep-only defaults (daily rotation / scrape:local are unchanged):
 * - MAX_ENRICHED via SCRAPE_SWEEP_MAX or 1500 (ignores Infisical enrich default 500)
 * - THROTTLE_MS=250 when unset
 * - SCRAPE_SKIP_CACHED=1 when unset (skip ids with page_snapshot)
 */
process.env.MAX_ENRICHED = process.env.SCRAPE_SWEEP_MAX?.trim() || '1500';
if (!process.env.THROTTLE_MS?.trim()) {
  process.env.THROTTLE_MS = '250';
}
if (!process.env.SCRAPE_SKIP_CACHED?.trim()) {
  process.env.SCRAPE_SKIP_CACHED = '1';
}

await import('./scrape.mjs');
