# First GitHub Release (draft → publish + smoke test)

**Milestone:** release  
**Depends on:** tasks 22–24 (25 optional); task-23 updater keys; task-27 Backend readiness  
**Blocked by:** [2026-07-21 security review](../reports/2026-07-21-security-review-main.md) — do not publish until task-23 High (updater signing / no placeholder pubkey) and task-27 Mediums (abuse controls, no hardcoded Backend default for release builds, `/audit` tuning) are addressed  
**Priority:** 26

## Goal

Cut the first public versioned Release (`v*`), publish the draft from Actions, and verify install + updater on clean machines.

## Context

Flow already documented: `npm run release:prepare` → tag → [`release.yml`](../../.github/workflows/release.yml) → **draft** → manual publish. `uploadUpdaterJson: true` already set.

## Scope

- [ ] Confirm security-review gate: task-23 High + task-27 Mediums cleared (see report)
- [ ] Ensure Backend API production URL works for desktop builds (see task-27) before tagging
- [ ] Run `npm run release:prepare vX.Y.Z` on a clean tree
- [ ] Push tag; watch macOS / Windows / Linux matrix
- [ ] Fix any CI failures (secrets, seed check, signing)
- [ ] Publish the **draft** release on GitHub
- [ ] **Clean Mac smoke test:** download DMG from the release URL (not a local artifact), move `Skilltopia.app` to `Applications`, run `xattr -dr com.apple.quarantine "/Applications/Skilltopia.app"` if Gatekeeper blocks opening, then verify the app launches and the catalog loads
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
