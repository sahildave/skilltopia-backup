# Windows code signing

**Milestone:** release  
**Depends on:** task-22  
**Priority:** 25  
**Note:** Soft requirement for v1 — unsigned MSI works but SmartScreen warns

## Goal

Sign the Windows `.msi` in CI so ProductHunt / Windows users see fewer SmartScreen “unknown publisher” warnings.

## Context

[`.github/workflows/release.yml`](../../.github/workflows/release.yml) builds MSI but has no Authenticode secrets. OV cert is the common path; EV / Azure Trusted Signing reduces SmartScreen reputation delay faster at higher cost.

**Pragmatic default if budget is tight:** ship unsigned for first Release, document “More info → Run anyway”, prioritize task-24 for mac.

## Scope

- [ ] Buy or obtain a code signing cert (OV or EV / cloud signing)
- [ ] Export or configure CI access (PFX secrets or Azure Trusted Signing)
- [ ] Wire secrets into the Windows matrix job in `release.yml`
- [ ] Document install + SmartScreen expectations in README / release body
- [ ] Smoke-test signed MSI on a clean Windows VM

## Out of scope

- Microsoft Store listing
- WiX UI customization beyond current Tauri defaults

## Done when

- CI attaches a signed MSI (or decision recorded: intentionally unsigned for v1)
- Install path documented for PH / README
