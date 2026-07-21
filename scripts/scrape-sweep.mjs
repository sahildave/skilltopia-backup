/** Full corpus scrape toward MAX_ENRICHED (default 1500; set 1000 if too heavy). */
if (!process.env.MAX_ENRICHED?.trim()) {
  process.env.MAX_ENRICHED = '1500';
}

await import('./scrape.mjs');
