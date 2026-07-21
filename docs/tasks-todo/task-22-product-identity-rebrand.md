# Product identity and desktop rebrand

**Milestone:** release  
**Depends on:** task-20 (name/owner settled)  
**Priority:** 22

## Goal

Replace template identity with the real product name, bundle ID, publisher strings, icons, and release workflow branding so binaries and GitHub Releases look like Skills Explorer.

## Context

[`src-tauri/tauri.conf.json`](../../src-tauri/tauri.conf.json) still has `productName: "tauri-app"`, `identifier: "com.tauri-app.app"`, placeholder publisher/descriptions. [`.github/workflows/release.yml`](../../.github/workflows/release.yml) still titles releases “Tauri Template App”.

## Scope

- [ ] Lock final **app name**, **bundle identifier**, publisher, copyright, short/long description, category
- [ ] Update `tauri.conf.json` (+ platform overlays if any) with those values
- [ ] Finalize icons under `src-tauri/icons/` (PNG set, `.icns`, `.ico`)
- [ ] Update release workflow `releaseName` / `releaseBody` install copy to the real product name
- [ ] Align window title / About strings / i18n product name if still template-ish
- [ ] Decide first public semver (`v0.1.0` vs `v1.0.0`) and document in [`docs/developer/releases.md`](../developer/releases.md)

## Out of scope

- Apple/Windows signing (tasks 24–25)
- Updater pubkey/endpoints (task-23)
- App Store listing assets (task-29)

## Done when

- Local `tauri build` artifact name and About metadata match the product
- CI release draft title would not say “Template”
- Icons look intentional on mac Dock and Windows installer
