# Web + desktop architecture docs (agents)

**Milestone:** web-desktop  
**Depends on:** none (do first)

## Goal

Document dual-client architecture so agents do not invent CORS, monorepos, or Tauri-in-web imports.

## Scope

- [x] Add `docs/developer/web-and-desktop.md`
- [x] Link from `docs/developer/README.md`
- [x] Update `docs/developer/external-apis.md` (web same-origin + Tauri Rust; no CORS)
- [x] Document script matrix, TARGET, ports, shells
- [x] **Required: “What would break / how we avoid it”:**
  - Desktop React `fetch(https://deploy/api/…)` → CORS → CatalogPort desktop → Tauri commands
  - Shared UI importing `@tauri-apps/*` → Tauri in web bundle → `@platform` / `@catalog` aliases only
  - Dynamic `import('@tauri-apps/…')` still emits chunks → not enough → web graph must not reference desktop adapter
  - Browser CORS on `/api/*` → abuse → same-origin web only
  - Absolute Backend URL in browser without proxy → use relative `/api` + Vite proxy in dev
  - Branching on `isTauri` / platform name → port methods / capabilities
  - Backend secrets in `VITE_*` or Tauri binary → forbidden
  - Backend proxy inside `dev:all` → not our workflow
- [x] Point epic `task-x-web-desktop-dual-client` at this doc

## Done when

Doc + README link + external-apis update; anti-pattern section agent-actionable.
