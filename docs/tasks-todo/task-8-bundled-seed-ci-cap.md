# Bundled first-run seed + CI size cap

**Epic:** Skills Explorer MVP (24h)  
**Milestone:** mvp  
**Depends on:** task-4 (enrichment available to include); task-6 consumes seed

## Goal

Ship a **small generated seed** so first open isn’t an empty dashboard.

## Decisions

- Include top leaderboard slice **plus enrichment when present** (not metadata-only)
- Generate via **script** (build/CI) — do not hand-maintain forever
- **App size matters:** soft target ~200–300 KB; **CI fails if seed > 250 KB**

## Scope

- [ ] `npm` script to export seed from Backend API / local DB snapshot  
- [ ] Bundle seed into the desktop app  
- [ ] CI check: fail when seed artifact > 250 KB  
- [ ] Truncate/limit skill count or summary length to stay under cap  

## Out of scope

- Large offline corpus / full enriched set in the binary

## TDD seams

- Seed size guard: build/CI fails when fixture exceeds 250 KB

## Done when

- Fresh install shows seeded skills before first successful network refresh
- CI enforces the 250 KB ceiling
