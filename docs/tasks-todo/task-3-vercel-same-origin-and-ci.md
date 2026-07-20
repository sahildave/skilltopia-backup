# Vercel same-origin deploy + CI no Tauri in web bundle

**Milestone:** web-desktop  
**Depends on:** task-2 (`build:web`)  
**Absorbs:** former task-5 vercel, task-6 CI

## Goal

Serve web static + `api/` from **one Vercel project** (browser same-origin `/api/*`, no CORS) and **enforce** zero Tauri markers in the web production bundle.

## Scope

### Deploy

- [ ] Update `vercel.json`: `build:web` → static output, SPA rewrites, keep `api/`
- [ ] Do **not** add CORS headers on `/api/*`
- [ ] Confirm Tauri still uses Rust → deploy URL (unchanged)
- [ ] Update deploy notes in `web-and-desktop.md` / `external-apis.md`
- [ ] No Backend secrets in frontend env (`VITE_*` forbidden for secrets)

### CI hard-no

- [ ] Script after `build:web` scanning `dist/` for `@tauri-apps`, `__TAURI__`, and agreed invoke markers
- [ ] Wire into CI and/or `check:all`
- [ ] Document failure mode in the anti-patterns section of `web-and-desktop.md`

## Out of scope

- Separate web domain + CORS allowlist
- User auth on catalog

## Done when

- Production web loads and hits same-origin `/api/skills*`
- Desktop catalog still works via Rust
- Intentional Tauri import in a shared module fails CI on `build:web`; clean build passes
