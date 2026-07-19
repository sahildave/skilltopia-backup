# Enrichment pipeline

Run the bounded seed pipeline with `npm run enrich:local`. It reads the top
leaderboard slice, stores each detail response in the private repository,
extracts required metadata with the configured AI model chain, falls back to
rule-based extraction, and upserts distilled text into Qdrant. Configure
`OPENAI_API_KEY` and an optional comma-separated `ENRICHMENT_MODEL_CHAIN`
(for example `gpt-4o-mini,gpt-4o`) alongside the Supabase and Qdrant variables.
The local process also needs `VERCEL_OIDC_TOKEN` unless it is run through a
linked Vercel environment.

Use `npm run enrich:local -- --sync` for the sync stub. Seed mode skips every
skill that already has enrichment; sync mode re-enriches only when the detail
hash differs from the stored hash. `MAX_ENRICHED` is capped at 500 in code.
