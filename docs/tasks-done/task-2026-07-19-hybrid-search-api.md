# Hybrid search Backend API

**Epic:** Skills Explorer MVP (24h)  
**Milestone:** mvp  
**Depends on:** task-1, task-3, task-4 (semantic needs enriched vectors; keyword needs proxy)

## Goal

One smart search box backed by a Backend API that merges:

1. **Keyword** — skills.sh search (full registry)  
2. **Semantic** — Qdrant knn over enriched subset (~500)

## Ranking policy (locked)

- Keyword / exact matches first  
- Then semantic matches  
- Boost highly installed  
- De-duplicate identical skills  

## Scope

- [ ] `GET` (or equivalent) hybrid search on Backend API  
- [ ] Merge/rank implementation  
- [ ] Desktop client calls Backend API for search (replace or wrap existing search hook)

## Out of scope

- Meilisearch full-corpus keyword (post-mvp)
- Semantic-first ranking
- Two separate UI result sections (unless ranking fails and we temporarily fall back)

## TDD seams

- Hybrid merger: ordering (keyword → semantic), de-dupe, install boost

## Done when

- Typing a query returns one ranked list with the locked policy
- Works with empty Qdrant (keyword-only degrade) without crashing
