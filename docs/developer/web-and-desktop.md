# Web and Desktop Dual Client

One repo, one `package.json`, one shared React skills UI. Two runtimes: a **Tauri desktop app** and a **browser web app**. Both call the same **Backend API**. Clients hold no Backend secrets.

This is the agent source of truth for dual-client work. Do not invent a monorepo, CORS on `/api/*`, or Tauri imports in shared UI. See the epic: `docs/tasks-todo/task-x-web-desktop-dual-client.md`.

## Mental model

```
┌─────────────────────────────────────────────────────────────┐
│  Shared skills UI (React)                                   │
│  imports only @platform / @catalog — never @tauri-apps/*    │
└───────────────┬─────────────────────────────┬───────────────┘
                │                             │
     Vite TARGET=web|mock              Vite TARGET=desktop
                │                             │
    ┌───────────▼───────────┐     ┌───────────▼───────────┐
    │ Web / mock adapters   │     │ Desktop adapters      │
    │ CatalogPort: fetch    │     │ CatalogPort: Tauri    │
    │   relative `/api/…`   │     │   commands → Rust     │
    │ PlatformPort: limited │     │   → Backend URL       │
    └───────────┬───────────┘     │ PlatformPort: fs etc. │
                │                 └───────────┬───────────┘
                │                             │
                ▼                             ▼
         same-origin /api              reqwest (no CORS)
                │                             │
                └──────────┬──────────────────┘
                           ▼
                    Backend API (api/ on Vercel)
```

| Concern           | Web                                              | Desktop                                        |
| ----------------- | ------------------------------------------------ | ---------------------------------------------- |
| Shell             | Thin browser shell (no titlebar/menu/updater)    | MainWindow, native menu, titlebar              |
| Catalog           | `fetch('/api/…')` same-origin                    | Tauri command → Rust → `SKILLS_PROXY_BASE_URL` |
| Native capability | Via `PlatformPort` (Phase-1 subset)              | Same port; desktop implements disk/install     |
| Secrets           | None in client; Backend only                     | Infisical `local` desktop-safe vars only       |
| Package layout    | Single package — **not** npm workspaces/`apps/*` | Same                                           |

## Capability ports and TARGET

Build-time adapters — not runtime `if (isTauri)` branching for catalog/platform. Landed in task-2; treat this contract as locked for agents now.

| Alias       | Resolves to (by `TARGET`)                    | Role           |
| ----------- | -------------------------------------------- | -------------- |
| `@platform` | `src/platform/index.{web\|desktop\|mock}.ts` | `PlatformPort` |
| `@catalog`  | `src/catalog/index.{web\|desktop\|mock}.ts`  | `CatalogPort`  |

`TARGET` values: `web` \| `desktop` \| `mock`. Vite `resolve.alias` picks the file. Shared UI and services import **only** these aliases.

### PlatformPort

- `hasLocalLibrary`
- `copiesInstallCommand`
- `getInstalledScan()` / `scanInstalled()` — normalized global scan snapshot
- `revealProviderSkillsDir(providerId)` — Finder/Explorer reveal (no rescan)
- `listInstalled()` / `listProviders()` — derived from the in-memory snapshot
- `install(skill, scope: 'global' \| 'project')`
- `openExternal(url)`

Desktop scanning runs in Rust (`scan_installed_skills`) over the vendored
provider registry: Universal (`~/.agents/skills`) plus each detected provider’s
direct global skills directory. Shared UI must not import `@tauri-apps/*`.

### Desktop skill install paths

Desktop `platform.install` runs `npx skills add` (shell plugin). Conventions:

| Scope     | CLI flags                                                       | Typical on-disk location                                          |
| --------- | --------------------------------------------------------------- | ----------------------------------------------------------------- |
| `global`  | `-g -y` plus `-a <id>` per detected non-universal provider only | Universal (`~/.agents/skills`) and symlinks for detected agents   |
| `project` | `-y` plus `-a <id>` per detected non-universal provider only    | `<chosen-project>/.agents/skills` and detected agent project dirs |

Desktop install reads the cached provider scan and never passes `-a '*'`, so undetected registry agents do not get new folders. Universal agents (Cursor, Codex, etc.) read from `~/.agents/skills` and do not need an explicit `-a` flag. Web `install` copies a universal-only command (no scan available).

Skill ids are `owner/repo/skill` → CLI source `owner/repo` + `--skill skill`. Web `install` copies a pasteable `npx skills add …` command (`copiesInstallCommand: true`). Desktop runs the same args via the shell plugin. Shared UI must not import `@tauri-apps/*`; only `index.desktop.ts` may.

### CatalogPort

| TARGET    | Implementation                                   |
| --------- | ------------------------------------------------ |
| `web`     | `fetch('/api/…')` (relative; Vite proxy in dev)  |
| `desktop` | Tauri `commands.*` → Rust → Backend absolute URL |
| `mock`    | Fixtures (no network, no `@tauri-apps/*`)        |

## Entries and shells

| Entry           | Shell                                 | Notes                                    |
| --------------- | ------------------------------------- | ---------------------------------------- |
| `entry-web`     | Thin browser chrome                   | Looks like a web app                     |
| `entry-desktop` | Existing MainWindow / desktop startup | Titlebar, menus, updater paths stay here |
| mock            | Same as web shell + fixture ports     | Chrome Inspect for Library-like UI       |

Web module graph must not import desktop-only startup (menus, quick panes, recovery, prefs UI in Phase-1).

## Script matrix

| Script            | What runs                           | TARGET    | Notes                                                                                |
| ----------------- | ----------------------------------- | --------- | ------------------------------------------------------------------------------------ |
| `dev` / `dev:web` | Vite browser shell                  | `web`     | Vite proxies `/api` → deployed Backend                                               |
| `dev:mock`        | Vite browser shell + fixtures       | `mock`    | No Backend required for UI states                                                    |
| `dev:all`         | web Vite **+** `tauri:dev` only     | both      | Web on `:5173`, Tauri Vite on `:1420`. **No** `proxy:dev`                            |
| `tauri:dev`       | Tauri + Vite child (`desktop.html`) | `desktop` | Rust → deployed Backend (or Infisical override)                                      |
| `build:web`       | Static web bundle + Tauri scan      | `web`     | Fails if `dist/` contains Tauri markers (`scan:web-bundle`)                          |
| `scan:web-bundle` | Scan `dist/` only                   | n/a       | Used by `build:web` / CI; markers: `@tauri-apps`, `__TAURI__`, `__TAURI_INTERNALS__` |
| `build:desktop`   | Desktop + quick-pane bundle         | `desktop` | Used by Tauri `beforeBuildCommand`                                                   |
| `proxy:dev`       | Local Backend on `:3000`            | n/a       | Optional with `tauri:dev:local` — **not** part of `dev:all`                          |
| `dev:local:proxy` | `proxy:dev` + `tauri:dev:local`     | desktop   | Optional both-local path; see [external-apis.md](./external-apis.md)                 |

### Network ports (TCP)

| Process                                      | Port                                                  |
| -------------------------------------------- | ----------------------------------------------------- |
| Vite (`dev` / `dev:web` / `dev:mock` alone)  | `1420`                                                |
| Vite web half of `dev:all`                   | `5173` — **Chrome web app URL** when both are running |
| Vite desktop half of `dev:all` / `tauri:dev` | `1420` — Tauri WebView only (desktop adapters)        |
| Local Backend (`vercel dev`)                 | `3000`                                                |

### Chrome-first workflow

- Day-to-day **UI** work: Chrome + `npm run dev` / `dev:web`. Open `http://localhost:1420`.
- With `npm run dev:all`: Chrome opens `http://localhost:5173` automatically (web TARGET). Do **not** open `:1420` in Chrome for catalog UI — that Vite is TARGET=desktop and will fail Tauri invokes in the browser.
- Catalog calls go to relative `/api/*`; Vite proxies them to the deployed Backend (`SKILLS_PROXY_BASE_URL` or `https://skilltopia.coduo.co`).
- Use Tauri (`tauri:dev` / `dev:local`) when you need filesystem, install, opener, or desktop shell (titlebar/menu).
- `npm run dev:mock` exercises Library / installed-list UI from fixtures without a desktop binary or Backend.

## Deploy (same-origin web + API)

One Vercel project serves Vite `dist/` and `api/`:

- `vercel.json`: `buildCommand` = `npm run build:web`, `outputDirectory` = `dist`, SPA rewrite to `/index.html`
- Browser catalog uses relative `/api/*` (same origin) — **no CORS** headers on `/api/*`
- Desktop is unchanged: Rust `reqwest` → deploy URL (`SKILLS_PROXY_BASE_URL` / default)
- `devCommand` stays the API-only placeholder so `vercel dev` does not start Vite (Tauri / Chrome Vite own the UI ports)
- Never put Backend secrets in `VITE_*` or the web bundle

See [external-apis.md](./external-apis.md).

## Backend access (no CORS)

| Client   | How it reaches Backend                                       |
| -------- | ------------------------------------------------------------ |
| Web prod | Same origin: static site + `api/` on one Vercel project      |
| Web dev  | Relative `/api` + Vite `server.proxy['/api']` → deploy URL   |
| Desktop  | Rust `reqwest` to absolute Backend URL (CORS does not apply) |

**Do not** add browser CORS headers on `/api/*`. See [external-apis.md](./external-apis.md).

## Secrets

| Location                             | Allowed                                                   |
| ------------------------------------ | --------------------------------------------------------- |
| Infisical `dev` / `prod` → Vercel    | Backend secrets (Supabase, Qdrant, LLM, …)                |
| Infisical `local` → Tauri            | Desktop-safe only (e.g. optional `SKILLS_PROXY_BASE_URL`) |
| `VITE_*` / web bundle / Tauri binary | **Never** Backend secrets                                 |

See [infisical.md](./infisical.md).

## What would break / how we avoid it

Agent-actionable anti-patterns. Each row is a failure mode and the rule that prevents it.

| What would break                                                                         | How we avoid it                                                                                                                                                                                                  |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop React `fetch(https://deploy/api/…)` → CORS / leaked browser path                 | CatalogPort **desktop** adapter uses Tauri commands only; Rust owns the Backend URL                                                                                                                              |
| Shared UI importing `@tauri-apps/*` → Tauri code in web bundle                           | Shared UI imports only `@platform` / `@catalog`; web adapters import zero `@tauri-apps/*`                                                                                                                        |
| Dynamic `import('@tauri-apps/…')` “gated” by `isTauri` still emits chunks into web graph | Not enough. Web `TARGET` module graph must never reference the desktop adapter or any `@tauri-apps/*` module                                                                                                     |
| Browser CORS enabled on `/api/*` → open abuse of OIDC-backed proxy                       | Same-origin web only; **no CORS** on `/api/*`. Desktop bypasses CORS via Rust                                                                                                                                    |
| Absolute Backend URL in browser without a proxy → CORS or wrong origin                   | Web uses relative `/api`; Vite proxies in dev; prod is same-origin on Vercel                                                                                                                                     |
| Branching on `isTauri` / platform name for catalog or install                            | Call **port methods** / capabilities (`hasLocalLibrary`, `install`, …), not stringly platform checks                                                                                                             |
| Backend secrets in `VITE_*` or the Tauri binary                                          | Forbidden. Secrets stay in Backend Infisical envs / Vercel only                                                                                                                                                  |
| Backend proxy (`proxy:dev`) inside `dev:all`                                             | Not our workflow. `dev:all` = web Vite + Tauri only; optional local Backend is a separate script                                                                                                                 |
| Monorepo / `apps/web` + `apps/desktop` workspaces                                        | Single package; build-time `TARGET` aliases                                                                                                                                                                      |
| Intentional Tauri import in a shared module ships in web `dist/`                         | `build:web` runs `scan:web-bundle` (also CI). Fails on `@tauri-apps`, `__TAURI__`, `__TAURI_INTERNALS__`. Fix: move the import behind `@platform` / `@catalog` desktop adapters only; re-run `npm run build:web` |

## Related docs

- [External APIs](./external-apis.md) — skills.sh proxy, Rust vs fetch, no CORS
- [Infisical](./infisical.md) — who gets which secrets
- [Architecture Guide](./architecture-guide.md) — broader mental models
- [Cross-Platform](./cross-platform.md) — OS-specific UI (macOS/Windows/Linux), not web-vs-desktop ports
