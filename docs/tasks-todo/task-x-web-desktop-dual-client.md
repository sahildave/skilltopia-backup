# Web + desktop dual client (epic)

**Milestone:** web-desktop  
**Priority:** unprioritized overview (`x`) — children are task-1…task-5

## Goal

Run **two apps** from one repo and one shared React skills UI: a **Tauri desktop app** and a **web app** for acquisition and quick search. Reuse UI; diverge only at shell and native capability boundaries. Both call the same **Backend API** with no secrets in clients.

## Context

- Absorbs former `task-x-post-mvp-1-web-app-client`.
- Team is small (2 people) — single package, not a monorepo/workspaces.
- UI work relies on **Chrome Inspect** — `dev:web` is primary (task-2 / Chrome-first notes).
- Feature disparity is intentional: Library → web “download the app”; Install → desktop writes disk, web copies command (task-4).
- Catalog today uses Tauri commands; web cannot. Do not add CORS on `/api/*`.

## Locked decisions

1. Not a monorepo — one `package.json`, shared `src/`, build-time adapters.
2. Same skills UI; different shells (web = webapp; desktop = titlebar/menu).
3. `PlatformPort` + `CatalogPort`; Vite `TARGET=web|desktop|mock`; UI does not import `@tauri-apps/*` for these paths.
4. Phase-1 PlatformPort only: `hasLocalLibrary`, `listInstalled()`, `listProviders()`, `install(skill, scope)`, `openExternal(url)`.
5. CatalogPort: web `fetch('/api/…')`; desktop Tauri commands → Rust → Backend URL.
6. One Vercel project: static web + `api/`; same-origin `/api/*`; **no CORS**; Tauri Rust unchanged.
7. Local: Vite proxy `/api` → deployed Backend; `dev:all` = web + Tauri only (no Backend proxy).
8. Hard no: zero Tauri markers in web production bundle (task-3).
9. Order: docs (task-1) → foundation (task-2) → deploy/CI (task-3) → shippable web (task-4) → desktop install (task-5).

## Child tasks

- [x] task-1 — architecture + anti-pattern docs
- [x] task-2 — dual-client foundation (ports, shells, scripts, Chrome-first, mock)
- [x] task-3 — Vercel same-origin deploy + CI no-Tauri-in-web-bundle
- [ ] task-4 — shippable web MVP (Library CTA + copy command)
- [ ] task-5 — desktop skill install (global/project)

## Out of scope

- npm workspaces / `apps/*` monorepo
- User auth on catalog (see post-mvp auth ticket)
- Web prefs / native menu / quick pane / recovery in Phase-1 web
- Enrichment / Qdrant / Supabase in the browser
- CORS on `/api/*`
- Desktop React `fetch` to Backend URL

## References

- **Architecture (agents):** [`docs/developer/web-and-desktop.md`](../developer/web-and-desktop.md) — TARGET, ports, script matrix, anti-patterns (task-1)
- `docs/tasks.md`
- [`docs/developer/external-apis.md`](../developer/external-apis.md) — Backend access, same-origin web, no CORS
