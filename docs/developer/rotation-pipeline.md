# Scrape rotation (daily 200 + queued)

Operator checklist: [page-cache-ops.md](./page-cache-ops.md).

Daily detail/scrape rotation after the list pass. Slot mix (deduped by
`skill_id`): **20 top + 10 hot + 10 trending + 160 oldest** `page_scraped_at`
(nulls first), then **append** new list members (empty `content_hash`) beyond
200, up to a per-run cap.

**Cap: `ROTATION_MAX`, default 500.** The slot mix always fits; the cap only
trims queued backlog, which drains over following days. At roughly 3.2s per
skill (detail, scrape, backfill, 1s throttle) that keeps a run near **27
minutes** — GitHub Actions minutes on a private repo are the binding
constraint, not throughput. Uncapped, a fresh corpus queues ~1,500 skills and
runs for well over an hour, every day. A capped run logs how many it deferred
and returns the count as `dropped`.

**Delisted skills.** When skills.sh answers **404** for a skill's detail, the
run stamps `skill_metadata.delisted_at` and drops it from both the queue and the
oldest slot. Without that, a deleted skill keeps an empty `content_hash`
forever, is retried every run, and holds the ingest exit code at 1. The
tombstone is sticky by design — clear `delisted_at` by hand if a skill really
comes back, since a re-sighting would just 404 again. Runs report the count as
`delisted`; only genuine failures land in `failed`.

## What it does

1. Load list slices for slot sources (`all-time` / `hot` / `trending`).
2. Load oldest page scrapes + empty-hash queue from Supabase.
3. `selectRotationIds` → skill id list.
4. Reuse the scrape pipeline with `skillIds` (hash-gated, one scrape retry,
   `/audit` refresh when hash changed or audits older than 7 days).

Default throttle is **1000ms** between skills (daily). One-shot `scrape:sweep` /
GHA `mode=sweep` default to **250ms** (`THROTTLE_MS`). Worst case ~2 OIDC calls/skill
(detail + audit) at 250ms still stays under the skills.sh **600/min**
per-project budget. Prefer the **ingest** Vercel project’s OIDC — see
[ingest-oidc.md](./ingest-oidc.md).

## Local

```bash
npm run rotate:local          # rotation only
npm run ingest:daily          # list-snapshots then rotation
npm run scrape:sweep          # one-shot fill (skip cached; default 1500 / 250ms)
# SCRAPE_SWEEP_MAX=1000 npm run scrape:sweep
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
