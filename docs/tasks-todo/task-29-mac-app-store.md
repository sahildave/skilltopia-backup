# Mac App Store distribution

**Milestone:** release  
**Depends on:** Apple Developer (same program as task-24); successful GitHub Releases channel  
**Priority:** 29 — later

## Goal

Ship Skills Explorer via the Mac App Store (separate from Developer ID GitHub Releases).

## Context

App Store needs **Apple Distribution** certs, App Store Connect listing, sandbox/entitlements review, privacy nutrition labels, and often different Tauri bundle targets. Keep GitHub Releases + Developer ID even after MAS if you want direct downloads.

## Scope

- [ ] App Store Connect app record + bundle ID alignment
- [ ] Sandbox entitlements review vs current desktop capabilities (fs, shell to `npx skills`, network)
- [ ] Resolve sandbox conflicts (CLI install via `npx` may be rejected or need redesign)
- [ ] MAS screenshots, description, privacy policy URL, age rating
- [ ] CI or local pipeline for `macappstore` / App Store pkg signing
- [ ] App Review submission + respond to rejections

## Out of scope

- Windows Store
- Dropping GitHub Releases

## Done when

- App is Available on the Mac App Store **or** a written decision that MAS is blocked by sandbox/CLI requirements (with GitHub-only distribution retained)

## Risk note

Desktop “install skill via skills CLI” may be incompatible with strict App Sandbox. Validate early before investing in listing polish.
