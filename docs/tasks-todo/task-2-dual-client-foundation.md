# Dual-client foundation (ports, shells, scripts, mock)

**Milestone:** web-desktop  
**Depends on:** task-1 recommended  
**Absorbs:** former task-2 ports, task-3 shells, task-4 scripts, task-7 Chrome-first, task-8 mock

## Goal

Make web and desktop runnable from one package: build-time ports/adapters, separate shells, scripts (`dev:web` / `dev:mock` / `dev:all` / `build:web`), Vite `/api` proxy, Chrome-first UI workflow, and mock fixtures for desktop UI states in Chrome.

## PlatformPort (Phase-1 only — do not expand without a new task)

- `hasLocalLibrary`, `listInstalled()`, `listProviders()`, `install(skill, scope: 'global'|'project')`, `openExternal(url)`
- Desktop install may stub until task-5; web copy may stub until task-4

## CatalogPort

- web: `fetch('/api/…')`; desktop: Tauri `commands.*` → Rust → Backend URL; mock: fixtures

## Scope

### Ports + TARGET

- [x] `src/platform/*` + `src/catalog/*` with `index.web.ts` / `index.desktop.ts` / `index.mock.ts`
- [x] Vite `resolve.alias` `@platform` / `@catalog` from `TARGET=web|desktop|mock`
- [x] Refactor `skills-sh.ts`, `read-global-skills.ts`, opener call sites onto ports
- [x] Tests; dashboard mocks `@catalog`
- [x] Web adapters import zero `@tauri-apps/*`

### Entries + shells

- [x] `entry-web` + thin browser shell (no titlebar/menu/updater) — web looks like a web app
- [x] `entry-desktop` keeps MainWindow / desktop startup
- [x] Web module graph must not import Tauri-only startup
- [x] Library whole-screen substitute when `!hasLocalLibrary` (stub OK; polish in task-4)
- [x] Wire Vite/HTML inputs for both entries
- [x] Omit web prefs / quick pane / recovery in Phase-1

### Scripts + Vite proxy

- [x] `dev:web` (`TARGET=web`); alias `dev` → `dev:web`
- [x] `dev:mock` (`TARGET=mock`)
- [x] `build:web`
- [x] `dev:all` = `dev:web` + `tauri:dev` only (**no** `proxy:dev` / Backend proxy process)
- [x] `tauri:dev` Vite child uses `TARGET=desktop`
- [x] Vite `server.proxy['/api']` → deployed Backend URL (env override)

### Chrome-first + mock

- [x] Document Chrome-first workflow in `web-and-desktop.md` + AGENTS.md note: UI in Chrome; Tauri for fs/install/opener
- [x] Complete mock PlatformPort + CatalogPort fixtures (`hasLocalLibrary=true`, fake installed list, mocked install)
- [x] `dev:mock` smoke-tested; mock imports zero `@tauri-apps/*`

## Out of scope

- Real desktop install body (task-5)
- Polished Library CTA / copy-command UX (task-4)
- Vercel production deploy config / CI scan (task-3)
- Requiring `vercel dev` for day-to-day UI
- Uninstall / reveal / read local README on the port

## Done when

- Shared UI imports only `@platform` / `@catalog`
- `npm run dev` / `dev:web` runs browser shell; Dashboard/search via proxied `/api`
- `dev:mock` shows Library-like UI from fixtures
- `dev:all` starts web + Tauri only
- Desktop chrome (titlebar/menu) unchanged
