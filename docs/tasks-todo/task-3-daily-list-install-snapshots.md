# Daily list install snapshots

**Milestone:** mvp  
**Depends on:** [task-1-skill-page-cache-schema](./task-1-skill-page-cache-schema.md)

## Goal

Each day, pull skills.sh leaderboard lists (`all-time` / `trending` / `hot`), refresh latest install counts, and append daily history rows for every skill seen — cheap list OIDC only.

## Context

Install graphs need `(skill_id, date, installs)` over time. List endpoints give current installs; they do **not** give history. New skills that appear on lists must enter the detail/scrape queue; null hash still means skip scrape until later.

OIDC cost for lists is small (paginated, `per_page` max 500). This pass does **not** call detail/audit for the whole corpus.

## Scope

- [ ] Daily (or scripted) list pass for **all-time**, **trending**, and **hot**
- [ ] Upsert latest `install_count` on `skill_metadata` for every skill seen
- [ ] Append/upsert `skill_install_snapshots` for every skill seen that day
- [ ] New list members → insert/ensure metadata + today’s snapshot → **queue** for detail/scrape
- [ ] Null hash → keep on queue; do not scrape until hash exists
- [ ] Document how to run locally before GHA (task-6)

## Out of scope

- HTML scrape / page_snapshot (task-2)
- `/audit` (task-4)
- Detail dialog sparkline UI (task-5)
- Growth rails / “fastest growing” analytics surface ([task-x-post-mvp-4](./task-x-post-mvp-4-analytics-install-history.md))

## Done when

- Running the list job updates `install_count` and writes one snapshot row per seen skill per day
- New trending/hot/top skills appear in metadata and are queued for detail
- Idempotent for the same calendar day (PK `(skill_id, date)`)
- `npm run check:all` passes
