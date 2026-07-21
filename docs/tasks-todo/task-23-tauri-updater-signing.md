# Tauri updater signing keys

**Milestone:** release  
**Depends on:** task-22 (real GitHub owner/repo in endpoint URL)  
**Priority:** 23  
**Security:** Clears High finding from [2026-07-21 security review](../reports/2026-07-21-security-review-main.md) (updater active with placeholder pubkey). Required before task-26 publish.

## Goal

Generate the Tauri updater keypair, put the **public** key and Releases endpoint in config, and store the **private** key only in GitHub Actions secrets so in-app updates verify.

## Context

This signs **update payloads**, not Gatekeeper/SmartScreen. Docs: [`docs/developer/releases.md`](../developer/releases.md). Config still has `YOUR_UPDATER_PUBLIC_KEY_HERE` and `YOUR_USERNAME/YOUR_REPO`. Workflow already expects `TAURI_PRIVATE_KEY` + `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Security review: `plugins.updater.active` is `true` while pubkey is still the placeholder; `prepare-release.js` treats any non-empty pubkey as configured.

## Scope

- [ ] `tauri signer generate -w ~/.tauri/skilltopia.key` (password optional but recommended)
- [ ] Store private key offline; never commit
- [ ] Set `plugins.updater.pubkey` in `tauri.conf.json`
- [x] Set endpoint to `https://github.com/<owner>/<repo>/releases/latest/download/latest.json`
- [ ] Add GitHub Actions secrets: `TAURI_PRIVATE_KEY`, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
- [x] Confirm secret names match [`.github/workflows/release.yml`](../../.github/workflows/release.yml)
- [x] Reject placeholder pubkey in `prepare-release.js` (and/or gate release CI); do not treat `YOUR_UPDATER_PUBLIC_KEY_HERE` as configured
- [x] Until a real pubkey is set: disable `plugins.updater.active` (or equivalent) so releases cannot ship unverified updates
- [x] Brief note in `releases.md` that keys were rotated/created for this product (no private material)

## Pending instructions

1. Generate a password-protected updater signing key outside the repository:

   ```bash
   npm run tauri -- signer generate -w ~/.tauri/skilltopia.key --password "<strong password>"
   ```

   The interactive `tauri signer generate -w ~/.tauri/skilltopia.key` command failed in Codex because the Tauri CLI could not read from an interactive password prompt. Use a local terminal, or pass the password non-interactively through a secure shell history-safe method.

2. Store the private key material offline and never commit it. The private key should live only in local secure storage and GitHub Actions secrets.

3. Replace `plugins.updater.pubkey` in `src-tauri/tauri.conf.json` with the generated public key, then set `plugins.updater.active` back to `true`.

4. Add these GitHub Actions repository secrets:
   - `TAURI_PRIVATE_KEY`: contents of `~/.tauri/skilltopia.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: the private-key password

5. Verify the repository secrets are present, then run:

   ```bash
   npm run test:run -- src/release-config.test.ts
   npm run typecheck
   npm run release:prepare v0.1.0
   ```

   `release:prepare` should fail until the placeholder public key is replaced and the updater is active.

6. After the key and secrets are installed, complete this task only when a draft release can produce `.sig` files and `latest.json` in task-26.

## Out of scope

- Apple notarization (task-24)
- Windows Authenticode (task-25)
- Changing updater UX in the app

## Done when

- Config has real pubkey + endpoint (no placeholder)
- Placeholder values fail prepare-release / release gate
- Secrets present on the repo
- A draft release can produce `.sig` + `latest.json` (verified in task-26)
