# Layered Explore search (cache-first, then API)

**Milestone:** mvp  
**Depends on:** Explore dashboard + `useSkillsLeaderboard` / `useSkillsSearch` (done)  
**Related:** [post-mvp-14 progressive keyword-first API](./task-x-post-mvp-14-search-progressive-results.md) (complementary; this task is client cache → hybrid API, not keyword-vs-semantic phases)

## Goal

On Explore, typing ≥2 characters opens a **search results view** that shows matches immediately from the **union of cached leaderboard tabs**, then merges Backend API hybrid search after a longer debounce, with a bottom-center “Searching…” indicator while the API is in flight. Leaderboard tab UIs stay **unfiltered**.

## Context

Today `SkillsDashboardView` hard-switches: after 300ms debounce and ≥2 chars it disables the leaderboard query and only calls `useSkillsSearch` → `GET /api/skills/search`. Cached trending/hot/top skills are unused for instant results.

Each visited discovery tab already lives in TanStack Query under `['skills-sh', 'leaderboard', view, perPage]` (typically ≤100 skills). That is the “running context” — not a full catalog.

## Approach

1. Enter search view from **raw** `searchInput` (≥2 chars).
2. Instant corpus = union of whatever leaderboard query entries exist this session (visited tabs only; no prefetch of all three).
3. Debounce API ~450ms; merge only when debounced query equals current input (avoid mid-typing stale merges).
4. Prefer cache entries with `dataUpdatedAt > 0`; fall back to seed-backed active tab only if nothing fetched yet.
5. Stable merge: local order first, append API-only skills by `id`.
6. Keep `useSkillsLeaderboard` enabled while searching so clearing search restores the unfiltered active tab.

## Scope

### Helpers

- [x] Add `collectCachedLeaderboardSkills` / `filterSkillsLocally` / merge helpers (e.g. `src/services/local-skills-search.ts`)
- [x] Unit tests: dedupe across tabs, name/slug/source match, API-only append, sync-gate behavior documented in tests where practical

### Explore UI

- [x] Update `SkillsDashboardView`: search view from raw input; leaderboard always enabled; dual debounce; merge; bottom-center “Searching…”
- [x] Tabs do not filter search results; clearing search restores unfiltered leaderboard for the active tab
- [x] Add `skills.dashboard.searching` (and mirror in other locale files if present)

### Tests

- [x] Extend `SkillsDashboardView` tests: local cache hits before API; “Searching…” while pending/out of sync; clear restores leaderboard

## Out of scope

- Prefetching all three tabs on Explore load
- Changing Backend API hybrid search / `semantic=` progressive phases (post-mvp-14)
- Client search over page-cache or full corpus

## Done when

- ≥2 chars opens search view with immediate local hits from cached leaderboard union
- API results append without replacing local order or merging against a mismatched query
- “Searching…” shows at bottom center while API debounce/fetch is outstanding
- Leaderboard grids are unchanged (not filtered in place)
- `npm run check:all` passes
