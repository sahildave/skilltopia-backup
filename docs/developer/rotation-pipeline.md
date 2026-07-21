# Scrape rotation (daily 200 + queued)

Daily detail/scrape rotation after the list pass. Slot mix (deduped by
`skill_id`): **20 top + 10 hot + 10 trending + 160 oldest** `page_scraped_at`
(nulls first), then **always append** new list members (empty `content_hash`)
even beyond 200.

## What it does

1. Load list slices for slot sources (`all-time` / `hot` / `trending`).
2. Load oldest page scrapes + empty-hash queue from Supabase.
3. `selectRotationIds` → skill id list.
4. Reuse the scrape pipeline with `skillIds` (hash-gated, one scrape retry,
   `/audit` refresh when hash changed or audits older than 7 days).

Default throttle is **1000ms** between skills. Worst case ~2 OIDC calls/skill
(detail + audit) ≈ **120 req/min**, well under the skills.sh **600/min**
per-project budget. Prefer the **ingest** Vercel project’s OIDC — see
[ingest-oidc.md](./ingest-oidc.md).

## Local

```bash
npm run rotate:local          # rotation only
npm run ingest:daily          # list-snapshots then rotation
MAX_ENRICHED=1000 npm run scrape:sweep   # one-shot sweep (default 1500; use 1000 if too heavy)
```

Progress on stderr; JSON summary on stdout.

## GHA

`.github/workflows/ingest.yml` runs daily list + rotation on a schedule, and
supports `workflow_dispatch` with `mode=sweep` toward `MAX_ENRICHED` (1500 or
1000 fallback). Secrets must come from the **ingest** project, not the app
Backend.

## Related

- [list-snapshots-pipeline.md](./list-snapshots-pipeline.md)
- [scrape-pipeline.md](./scrape-pipeline.md)
- [audit-cache.md](./audit-cache.md)
- [ingest-oidc.md](./ingest-oidc.md)
