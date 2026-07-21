# Skill audit API cache

**Milestone:** mvp  
**Depends on:** [task-1-skill-page-cache-schema](./task-1-skill-page-cache-schema.md)

## Goal

Persist skills.sh security audits via the official **`/audit` API** only — batch refresh when stale or hash-changed, and on-demand from the detail dialog without blocking the user on Supabase writes.

## Context

- Audits are **not** parsed from HTML badges (locked).
- skills.sh OIDC quota: **600 req/min per Vercel team+project**; app Backend also rate-limits clients.
- **App** project OIDC serves live user traffic (leaderboard/search + on-demand audit).
- **Ingest** project OIDC owns batch detail/scrape/audit refresh.
- Dialog must return audits to the client first; DB upsert is **async** (fire-and-forget / queue).

## Scope

- [x] Backend proxy for skills.sh `/audit` using **app** OIDC
- [x] Persist results to `skill_metadata.audits` + `audits_fetched_at`
- [x] On-demand dialog path: respond with audits first; **async** upsert so DB latency never blocks UI
- [x] Cache (server and/or TanStack) so repeat opens don’t rehit OIDC
- [x] Batch helper (for local scrape / later rotation): call `/audit` when **hash changed** or **`audits_fetched_at` older than 7 days**
- [x] Tests for cache key / stale window / async-write does not delay response shape

## Out of scope

- Scraping audit badges from HTML
- File tree / file contents
- Full page scrape on dialog open
- 200/day rotation wiring (task-6)

## Done when

- Cached skill with fresh audits serves without upstream `/audit`
- Uncached or stale path returns audits quickly; Supabase eventually consistent
- Batch refresh respects hash-change and 7-day staleness
- `npm run check:all` passes
