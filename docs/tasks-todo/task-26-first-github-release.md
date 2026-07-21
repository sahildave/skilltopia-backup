# First GitHub Release (draft → publish + smoke test)

**Milestone:** release  
**Depends on:** tasks 22–24 (25 optional); task-23 updater keys  
**Priority:** 26

## Goal

Cut the first public versioned Release (`v*`), publish the draft from Actions, and verify install + updater on clean machines.

## Context

Flow already documented: `npm run release:prepare` → tag → [`release.yml`](../../.github/workflows/release.yml) → **draft** → manual publish. `includeUpdaterJson: true` already set.

## Scope

- [ ] Ensure Backend API production URL works for desktop builds (see task-27) before tagging
- [ ] Run `npm run release:prepare vX.Y.Z` on a clean tree
- [ ] Push tag; watch macOS / Windows / Linux matrix
- [ ] Fix any CI failures (secrets, seed check, signing)
- [ ] Publish the **draft** release on GitHub
- [ ] **Clean Mac smoke test:** download DMG from release URL (not local artifact) — no `xattr`, app launches, catalog loads
- [ ] **Clean Windows smoke test:** MSI install; note SmartScreen if unsigned
- [ ] Confirm `latest.json` + `.sig` present; optional: second machine checks in-app update from a prior build
- [ ] Update README install links to the release assets

## Out of scope

- ProductHunt scheduling (task-28)
- App Store (task-29)

## Done when

- Published GitHub Release with mac + win artifacts
- Clean-machine install verified for the platforms you claim to support
- Updater manifest present and keyed correctly
