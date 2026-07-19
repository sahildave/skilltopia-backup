# Meilisearch full-corpus keyword (evolve to stack A)

**Milestone:** post-mvp  
**Post-MVP #:** 2  

## Goal

Replace or supplement skills.sh keyword search with a local **Meilisearch** (or Typesense) index over full registry metadata (~900K), keeping Qdrant for the enriched semantic head.

## Context

MVP uses skills.sh for keyword (stack B). Handoff stack A: Meilisearch all skills + Qdrant enriched subset.

## Scope

- [ ] Ingest registry metadata into Meilisearch  
- [ ] Backend API keyword path switches to Meilisearch  
- [ ] Keep hybrid merge policy  
- [ ] Daily/incremental refresh  

## Depends on

- Stable Backend API + mirror/ingest job
