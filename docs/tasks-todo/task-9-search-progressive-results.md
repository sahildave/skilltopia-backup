# Search performance: progressive keyword-first results

**Milestone:** mvp  
**Depends on:** task-8-search-performance-backend

## Goal

Perceived search latency drops to ~0.7s by showing keyword results immediately, then enriching with semantic matches.

## Context

Even after task-8, full hybrid search remains ~3–3.5s because Qdrant Cloud Inference runs at query time. Users wait for the entire waterfall before seeing any results.

## Approach

Two-phase client (recommended):

1. Client fetches keyword-only results first (~700ms)
2. Client fetches semantic enrichment in background
3. UI merges using the same locked ranking policy (keyword → semantic, install boost, de-dupe)

Alternative (out of scope unless Option A feels too chatty): SSE streaming from server.

## Scope

- [ ] Add `semantic` query param to `/api/skills/search` (default `true` for backward compat):
  - `semantic=false` → keyword-only, ~700ms
  - `semantic=true` → current hybrid (faster after task-8)
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
- Full hybrid list appears within **~3–4s** without replacing keyword results
- Works on web and desktop
- Degrades gracefully if semantic phase fails

## Expected gain

Perceived latency: **~0.7–1s** first paint vs **~4–5s** today.
