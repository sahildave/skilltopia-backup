# Vercel same-origin deploy + CI no Tauri in web bundle

**Milestone:** web-desktop  
**Depends on:** task-2 (`build:web`)  
**Absorbs:** former task-5 vercel, task-6 CI

## Goal

Serve web static + `api/` from **one Vercel project** (browser same-origin `/api/*`, no CORS) and **enforce** zero Tauri markers in the web production bundle.

## Scope

### Deploy

- [x] Update `vercel.json`: `build:web` → static output, SPA rewrites, keep `api/`
- [x] Do **not** add CORS headers on `/api/*`
- [x] Confirm Tauri still uses Rust → deploy URL (unchanged)
- [x] Update deploy notes in `web-and-desktop.md` / `external-apis.md`
- [x] No Backend secrets in frontend env (`VITE_*` forbidden for secrets)

### CI hard-no

- [x] Script after `build:web` scanning `dist/` for `@tauri-apps`, `__TAURI__`, and agreed invoke markers
- [x] Wire into CI and/or `check:all`
- [x] Document failure mode in the anti-patterns section of `web-and-desktop.md`

## Out of scope

- Separate web domain + CORS allowlist
- User auth on catalog

## Done when

- Production web loads and hits same-origin `/api/skills*`
- Desktop catalog still works via Rust
- Intentional Tauri import in a shared module fails CI on `build:web`; clean build passes
