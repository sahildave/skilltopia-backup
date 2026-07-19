# Skill detail enrichment UI + related

**Epic:** Skills Explorer MVP (24h)  
**Milestone:** mvp  
**Depends on:** task-2, task-4, task-5 (related via Qdrant)

## Goal

Skill detail (and/or card expansion) shows enrichment from Backend API / Supabase:

**MVP fields**

- AI summary (`primaryGoal` / summary)  
- Tags / technologies (`requires`, etc.)  
- Difficulty (`estimatedComplexity`)  
- Audience (`bestFor`)  
- **Related skills** (Qdrant neighbors → hydrate from repository)

## Stretch (if time) — richer “Related” / sidebar

From handoff “full sidebar” / schema extras — only if MVP above is done:

- Estimated read time, tokens, frameworks, last updated, `worksWith`, `outputs`, confidence display, etc.

## Scope

- [ ] Backend read endpoint(s) for enrichment + related ids  
- [ ] Desktop UI for MVP fields  
- [ ] Related list navigation  
- [ ] Graceful empty state when skill not enriched  

## Out of scope

- Compare two skills, AI chat (post-mvp)
- Cross-ecosystem sources (post-mvp)

## Done when

- Opening an enriched skill shows MVP fields + related
- Unenriched skills still usable (leaderboard metadata only)
