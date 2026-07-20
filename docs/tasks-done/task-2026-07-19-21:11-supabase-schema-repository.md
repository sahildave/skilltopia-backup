# Supabase schema + thin repository

**Epic:** Skills Explorer MVP (24h)  
**Milestone:** mvp  
**Depends on:** task-1 (Backend API reachable; optional parallel after API skeleton)

## Goal

Persist enrichment metadata and raw skill files on Supabase free tier behind a **thin repository interface** so callers never talk to Supabase SDKs directly.

## Storage policy

- **Postgres:** skill id, hashes, install metadata mirrors as needed, enrichment JSON (required core + optional extras), Storage path pointers
- **Supabase Storage:** raw `SKILL.md` (+ supporting files as needed)
- Do **not** dump large markdown into Postgres text columns

## Enrichment schema (canonical)

Required core (examples): `primaryGoal`, `requires`, `estimatedComplexity`, `bestFor`  
Optional: `worksWith`, `outputs`, `confidence`, etc.  
Derived without LLM: `estimatedReadTime` (from content length)

## Repository API (illustrative)

- `getSkillEnrichment(skillId)`
- `upsertSkillEnrichment(record)`
- `getByContentHash(hash)` / list missing enrichment
- `putRawSkillFiles(...)` / `getRawSkillFiles(...)`

## Scope

- [ ] Supabase project + migrations for metadata tables
- [ ] Storage bucket for raw skill files
- [ ] Thin repository module used only from Backend API / scripts
- [ ] Env secrets only on Backend API / local enrich script

## Out of scope

- Meilisearch / full-corpus index (post-mvp / stack A)
- Client-side Supabase keys in Tauri

## TDD seams

- Repository: upsert/get by id; missing enrichment vs hash lookup behavior

## Done when

- Backend/script can store and reload enrichment + raw files via repository only
- Free-tier-friendly (DB for rows; Storage for blobs)

## References

- Grilling decisions: stack B→A, schema B with required/optional split
