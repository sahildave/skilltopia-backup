# Local query embedding (remove Qdrant inference from hot path)

**Milestone:** post-mvp  
**Post-MVP #:** 12  
**Depends on:** task-1-search-performance-backend, qdrant-embeddings-setup (done)

## Goal

Remove Qdrant Cloud Inference from the query hot path (~2–4s saved on semantic leg).

## Context

`searchSkillsByText` sends `{ text, model }` to Qdrant, which runs `sentence-transformers/all-MiniLM-L6-v2` inference at query time. Upsert-time inference is fine; query-time inference dominates search latency.

## Scope

- [ ] Embed query text locally in the Backend API (e.g. `@xenova/transformers`, or dedicated embedding microservice)
- [ ] Send pre-computed vector to Qdrant `points/query` instead of `{ text, model }`
- [ ] Keep upsert path unchanged (Qdrant inference at write time is acceptable)
- [ ] Benchmark: target semantic leg **< 500ms**
- [ ] Document env / model alignment with `QDRANT_EMBEDDING_MODEL` and `QDRANT_VECTOR_SIZE`

## Out of scope

- Changing embedding model (must stay compatible with indexed vectors)
- Client-side embedding
- Meilisearch keyword path

## Done when

- Semantic search leg consistently **< 500ms** warm
- Vector dimensions and model match existing Qdrant collection
- Hybrid merge policy unchanged
- `npm run check:all` passes

## Expected gain

Semantic leg: **~3–4s → < 500ms**.
