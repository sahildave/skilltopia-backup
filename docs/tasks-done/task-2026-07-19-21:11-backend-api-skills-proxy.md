# Backend API: skills.sh proxy (Tauri → backend only)

**Epic:** Skills Explorer MVP (24h)  
**Milestone:** mvp  
**Depends on:** none

## Goal

Route all skills.sh traffic through the **Backend API** (`api/` on Vercel). The Tauri app must not hold skills.sh / OIDC / provider secrets — only call the Backend API.

## Vocabulary

- **Backend API** = Vercel-hosted HTTP API under `api/` (see `AGENTS.md`).

## Context

- Existing pieces: `api/_lib/proxy.ts`, `api/skills.ts`, `api/skills/search.ts`, Tauri `fetch_skills_leaderboard` / `search_skills`, React hooks in `src/services/skills-sh.ts`.
- Auth model (MVP): **public read** for leaderboard/search; writes/enrichment stay server-side only.

## Scope

- [ ] Backend API endpoints for leaderboard views: `all-time`, `trending`, `hot`
- [ ] Backend API endpoint for keyword search (skills.sh)
- [ ] Point Tauri/desktop client at Backend API (no upstream secrets in the app)
- [ ] Preserve rate-limit headers / sensible caching where already present
- [ ] CORS/methods as needed for the desktop client

## Out of scope

- Enrichment, Qdrant, Supabase
- In-app skill install / copy command (post-mvp)
- User auth beyond public read

## TDD seams

- Backend API skills proxy: status codes, response shape, client never receives upstream credentials

## Done when

- Dashboard can load Top Installed / Trending / Hot and keyword search via Backend API only
- `npm run check:all` passes for touched code

## References

- `docs/Skills.sh_Explorer_Research_and_Architecture_Handoff.md`
- `AGENTS.md` → Vocabulary
