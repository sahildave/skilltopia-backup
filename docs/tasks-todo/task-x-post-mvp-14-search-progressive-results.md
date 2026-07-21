# Search performance: progressive keyword-first results

**Milestone:** post-mvp  
**Post-MVP #:** 14  
**Depends on:** optional [post-mvp-13 backend micro-opts](./task-x-post-mvp-13-search-performance-backend.md)  
**Related:** most valuable while query-time Qdrant inference remains; re-evaluate after [post-mvp-12 local embeddings](./task-x-post-mvp-12-query-embedding-local.md). Client cache-first Explore UX is [task-08](./task-08-layered-explore-search.md) (complementary, not a substitute).

## Goal

Perceived search latency drops to ~0.7–1s by showing keyword results immediately, then enriching with semantic matches.

## Context

Full hybrid search stays slow while Qdrant Cloud Inference runs at query time. Users wait for the entire waterfall before seeing any results. Progressive keyword-first is a UX bandage until post-mvp-12 removes inference from the hot path (after which this may be unnecessary).

## Approach

Two-phase client (recommended):

1. Client fetches keyword-only results first (~700ms)
2. Client fetches semantic enrichment in background
3. UI merges using the same locked ranking policy (keyword → semantic, install boost, de-dupe)

Alternative (out of scope unless Option A feels too chatty): SSE streaming from server.

## Scope

- [ ] Add `semantic` query param to `/api/skills/search` (default `true` for backward compat):
  - `semantic=false` → keyword-only, ~700ms
  - `semantic=true` → current hybrid
- [ ] Update `useSkillsSearch` in `src/services/skills-sh.ts`:
  - Phase 1: fetch keyword results, render immediately
  - Phase 2: fetch semantic enrichment, merge into list
- [ ] Update `SkillsDashboardView` loading states — show keyword results with subtle "finding more…" indicator; no layout shift when semantic results append
- [ ] Desktop path: same two-phase via Tauri → Backend API
- [ ] i18n strings for progressive loading state

## Out of scope

- Separate UI sections for keyword vs semantic (locked policy: one ranked list)
- Changing debounce (300ms is fine)
- SSE / streaming server response

## Done when

- User sees first results within **~1s** of stopping typing (debounce + keyword)
- Full hybrid list appears without replacing keyword results
- Works on web and desktop
- Degrades gracefully if semantic phase fails

## Expected gain

Perceived latency: **~0.7–1s** first paint vs full hybrid wait.
