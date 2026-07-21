# macOS Developer ID signing and notarization

**Milestone:** release  
**Depends on:** Apple Developer Program enrollment; task-22  
**Priority:** 24  
**Blocks:** no-`xattr` downloads for ProductHunt users

## Goal

Ship a **Developer ID–signed and notarized** `.dmg` from CI so Gatekeeper accepts internet downloads without `xattr -cr`.

## Context

Today `signingIdentity` is `"-"` (ad-hoc) in `tauri.conf.json`. Ad-hoc builds quarantine when downloaded. App Store distribution is a **later** track (task-29); GitHub Releases need **Developer ID Application** + notarization + staple.

**Start enrollment today** even if CI wiring waits — Apple approval is wall-clock.

## Scope

### Manual (Apple)

- [ ] Enroll in Apple Developer Program ($99/yr); wait for approval
- [ ] Create **Developer ID Application** certificate
- [ ] Export `.p12` + password; prepare App Store Connect API key **or** Apple ID + app-specific password + Team ID for notarytool
- [ ] Add GitHub secrets (Tauri-typical): `APPLE_CERTIFICATE`, `APPLE_CERTIFICATE_PASSWORD`, `APPLE_SIGNING_IDENTITY`, plus notarization credentials (`APPLE_API_KEY` / `APPLE_API_ISSUER` / key file, or `APPLE_ID` + `APPLE_PASSWORD` + `APPLE_TEAM_ID`)

### Repo / CI

- [ ] Set real `bundle.macOS.signingIdentity` (or document env-driven identity)
- [ ] Extend [`.github/workflows/release.yml`](../../.github/workflows/release.yml) macOS job: import cert into keychain, pass notarization env to `tauri-action`
- [ ] Update [`docs/developer/releases.md`](../developer/releases.md) with Apple secret names and smoke-test steps
- [ ] Decide single-arch vs universal later; document current `macos-latest` limitation

## Out of scope

- Mac App Store sandbox / ASC listing (task-29)
- Windows signing (task-25)

## Done when

- CI produces a notarized DMG on tag
- Fresh Mac download from the **GitHub Release URL** opens without Terminal/`xattr`
- Stapling verified (`spctl` / Gatekeeper success)
