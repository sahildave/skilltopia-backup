# Scrape rotation and GHA

**Milestone:** mvp  
**Depends on:** [task-2-scrape-local-pipeline](./task-2-scrape-local-pipeline.md), [task-3-daily-list-install-snapshots](./task-3-daily-list-install-snapshots.md), [task-4-skill-audit-api-cache](./task-4-skill-audit-api-cache.md)

## Goal

After the local ramp to ~100 cached skills, run daily hash/scrape rotation at scale and move ingest to GitHub Actions for the ~1500 sweep and ongoing ops — on the **ingest** OIDC project, separate from the app Backend.

## Context

- Local `scrape:local` owns ramp **20 → 100**; this task owns **~1500** (fallback **1000** if too heavy) + daily schedule.
- Daily list pass (task-3) still refreshes installs for all list members; rotation only detail/scrapes a **200/day** slice plus **new** list members.
- Rotation slots (dedupe by `skill_id`): **20 top + 10 hot + 10 trending + 160 oldest** `page_scraped_at`.
- `/audit` on rotation when **hash changed** or audits older than **7 days**.
- Dual Vercel projects: ingest ≠ app (two 600/min OIDC budgets).

## Scope

- [x] Implement daily 200-skill rotation with the locked slot mix + dedupe
- [x] Always include **new** list members in the detail/scrape queue
- [x] Skip scrape until `hash` non-null; reuse task-2 scrape failure retry rules
- [x] Wire `/audit` refresh into rotation (hash change or 7-day stale)
- [x] GitHub Action schedule: daily list + rotation; one-shot/full sweep toward **1500** (fallback 1000)
- [x] Document dual OIDC projects, secrets, and how app vs ingest credentials are separated
- [x] Confirm OIDC usage stays within 600/min (batch pacing as needed)

## Out of scope

- Snapshot retention (e.g. drop rows older than 90 days) — optional later
- Related / enrichment UI
- Changing app on-demand audit path (already task-4)

## Done when

- GHA (or documented cron) runs daily list + 200 rotation without manual laptop runs
- New list skills get detail-queued; popular/trending/hot stay fresh via reserved slots
- Full sweep can reach ~1500 (or documented 1000 fallback) under `MAX_ENRICHED`
- Dual-OIDC setup is documented; `npm run check:all` passes
