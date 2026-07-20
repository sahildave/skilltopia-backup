# Enrichment pipeline (AI SDK + local seed + sync stub)

**Epic:** Skills Explorer MVP (24h)  
**Milestone:** mvp  
**Depends on:** task-2, task-3

## Goal

One-shot local enrichment for the head of the install distribution, with fallbacks and a thin sync stub for later.

## Decisions

- `MAX_ENRICHED = 500` (config knob; grow later toward 2K — post-mvp)
- **Vercel AI SDK** only for LLM calls; env-driven model chain; **rule-based always last**
- Embeddings via **Qdrant free inference** (not AI SDK embeddings)
- **Throttle + retry/backoff** for free LLM tiers
- Seed run: enrich **only when enrichment missing**
- Sync stub: re-enrich when content **hash changes**
- Run seed **locally** (`npm run …`); stub GitHub Action and/or secret-protected Backend route for later

## Pipeline

1. Fetch leaderboard / skill detail via Backend API or shared server modules
2. Store raw files in Supabase Storage; metadata + hash in Postgres
3. Rule-based extraction → LLM `generateObject` (required core + optional) → fallback partial
4. Distill text → Qdrant embed + upsert
5. Persist enrichment JSON via repository

## Scope

- [ ] Local enrich script
- [ ] AI SDK provider chain + rule-based fallback
- [ ] Throttle/backoff
- [ ] Sync stub (hash-change path) — can be minimal
- [ ] Wire repository + Qdrant helpers

## Out of scope

- Full daily cron production hardening
- Growing to 2K+ (post-mvp)
- Analytics snapshots

## TDD seams

- AI fallback chain: provider fail → next → rule-based produces usable partial
- Repository missing vs hash-change policy used by seed vs sync

## Done when

- Local run can enrich up to 500 skills (or fewer if rate-limited) into Supabase + Qdrant
- Sync stub exists and documents how hash re-enrich will work
