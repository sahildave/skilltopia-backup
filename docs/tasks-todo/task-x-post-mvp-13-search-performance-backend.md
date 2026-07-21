# Search performance: backend critical path

**Milestone:** post-mvp  
**Post-MVP #:** 13  
**Depends on:** hybrid-search-api (done), qdrant-embeddings-setup (done)  
**Related:** prefer [post-mvp-12 local query embedding](./task-x-post-mvp-12-query-embedding-local.md) for the real latency win; this task is small hot-path housekeeping only.

## Goal

Shave hybrid search overhead (~0.7–1.2s) with no API contract change. Does **not** remove Qdrant Cloud Inference from the hot path.

## Context

Hybrid search is still `skills.sh` keyword → Qdrant semantic → Supabase metadata merge (`api/skills/search.ts`). Historic warm latency was ~4–5s; Qdrant inference dominates (~3–4s). These micro-opts remain undone:

- Keyword proxy and `searchSkillsByText` still run **sequentially**
- `ensureQdrantCollection()` still GETs the collection on every query
- `getSkillMetadata` still `select('*')`

## Scope

- [ ] Parallelize independent legs in `api/skills/search.ts` — keyword proxy and `searchSkillsByText` via `Promise.all`; Supabase metadata fetch stays after semantic results
- [ ] Cache collection existence in `api/_lib/qdrant.ts` — module-level flag (or short TTL) so `ensureQdrantCollection` skips the GET after first success per instance
- [ ] Narrow Supabase metadata query in `getSkillMetadata` — `select('skill_id, repository, install_count, source_url, enrichment_required')` instead of `*`

## Out of scope

- UI changes
- Changing ranking policy (keyword → semantic, install boost)
- Moving embedding off Qdrant (see post-mvp-12)
- Meilisearch (see post-mvp-2)

## TDD seams

- `mergeHybridSearchResults` — already tested; no change
- New: mock `proxySkillsRequest` + `searchSkillsByText` to assert parallel invocation
- New: `ensureQdrantCollection` called once per cold instance, not per search

## Done when

- Warm `/api/skills/search?q=react&limit=50` improves by roughly the expected gain below (absolute target depends on current baseline)
- Keyword-only degrade still works when Qdrant or Supabase unavailable
- `npm run check:all` passes

## Expected gain

~700ms from parallelization + ~200–500ms from collection cache. Inference cost remains until post-mvp-12.
