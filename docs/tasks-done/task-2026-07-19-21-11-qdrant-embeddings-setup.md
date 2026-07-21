# Qdrant free cluster + embeddings setup

**Epic:** Skills Explorer MVP (24h)  
**Milestone:** mvp  
**Depends on:** task-2 (skill ids / payloads to attach)

## Goal

Set up Qdrant Cloud **free tier** with **Cloud Inference** for embeddings. Embed **distilled enrichment text**, not raw `SKILL.md`.

## Decisions

- Free Cloud Inference models only (Cost: Free in console)
- Start with the **smallest free dense text model**; model id **config-swappable**
- Index only enriched skills (`MAX_ENRICHED` starts at 500)
- Qdrant stores vectors (+ small payload e.g. `skillId`); full metadata stays in Supabase

## Scope

- [ ] Create free cluster; enable inference
- [ ] Collection with correct vector size for chosen model
- [ ] Backend/script helpers: upsert embedding, search knn by skill
- [ ] Config for model id (no hardcode forever)

## Out of scope

- Embedding all ~900K skills
- Paid embedding providers (OpenAI embeddings, etc.)

## Done when

- Can upsert ~N distilled texts and query nearest neighbors by `skillId`
- Fits free tier comfort zone (<< 1 GB)

## References

- Handoff: Qdrant feasibility + “embed distilled metadata”
