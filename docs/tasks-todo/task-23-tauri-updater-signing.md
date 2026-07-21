# Tauri updater signing keys

**Milestone:** release  
**Depends on:** task-22 (real GitHub owner/repo in endpoint URL)  
**Priority:** 23

## Goal

Generate the Tauri updater keypair, put the **public** key and Releases endpoint in config, and store the **private** key only in GitHub Actions secrets so in-app updates verify.

## Context

This signs **update payloads**, not Gatekeeper/SmartScreen. Docs: [`docs/developer/releases.md`](../developer/releases.md). Config still has `YOUR_UPDATER_PUBLIC_KEY_HERE` and `YOUR_USERNAME/YOUR_REPO`. Workflow already expects `TAURI_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`.

## Scope

- [ ] `tauri signer generate -w ~/.tauri/skills-explorer.key` (password optional but recommended)
- [ ] Store private key offline; never commit
- [ ] Set `plugins.updater.pubkey` in `tauri.conf.json`
- [ ] Set endpoint to `https://github.com/<owner>/<repo>/releases/latest/download/latest.json`
- [ ] Add GitHub Actions secrets: `TAURI_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- [ ] Confirm secret names match [`.github/workflows/release.yml`](../../.github/workflows/release.yml)
- [ ] Brief note in `releases.md` that keys were rotated/created for this product (no private material)

## Out of scope

- Apple notarization (task-24)
- Windows Authenticode (task-25)
- Changing updater UX in the app

## Done when

- Config has real pubkey + endpoint
- Secrets present on the repo
- A draft release can produce `.sig` + `latest.json` (verified in task-26)
