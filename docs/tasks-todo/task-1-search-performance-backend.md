# Search performance: backend critical path

**Milestone:** mvp (hotfix)  
**Depends on:** hybrid-search-api (done), qdrant-embeddings-setup (done)

## Goal

Cut hybrid search latency from ~4–5s to ~3–3.5s with no API contract change.

## Context

Live measurements on production deploy:

| Route | Latency |
|---|---|
| `GET /api/skills` (keyword proxy) | ~0.6–0.8s |
| `GET /api/skills/search` (hybrid) | ~4–5s |

The search handler in `api/skills/search.ts` runs skills.sh → Qdrant inference → Supabase **sequentially**. Qdrant Cloud Inference dominates (~3–4s). `ensureQdrantCollection()` adds an extra round-trip on every query.

## Scope

- [ ] Parallelize independent legs in `api/skills/search.ts` — keyword proxy and `searchSkillsByText` via `Promise.all`; Supabase metadata fetch stays after semantic results
- [ ] Cache collection existence in `api/_lib/qdrant.ts` — module-level flag (or short TTL) so `ensureQdrantCollection` skips the GET after first success per instance
- [ ] Narrow Supabase metadata query in `getSkillMetadata` — `select('skill_id, repository, install_count, source_url, enrichment_required')` instead of `*`

## Out of scope

- UI changes
- Changing ranking policy (keyword → semantic, install boost)
- Moving embedding off Qdrant
- Meilisearch

## TDD seams

- `mergeHybridSearchResults` — already tested; no change
- New: mock `proxySkillsRequest` + `searchSkillsByText` to assert parallel invocation
- New: `ensureQdrantCollection` called once per cold instance, not per search

## Done when

- `curl` to `/api/skills/search?q=react&limit=50` consistently **< 3.5s** warm (down from ~4–5s)
- Keyword-only degrade still works when Qdrant or Supabase unavailable
- `npm run check:all` passes

## Expected gain

~700ms from parallelization + ~200–500ms from collection cache.
