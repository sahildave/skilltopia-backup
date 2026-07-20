# Provider scan verification and performance gates

**Milestone:** provider-detection

**Depends on:** task-9-installed-skills-provider-ui

## Goal

Verify skills.sh parity, cross-client behavior, and the no-loading provider
filter experience before shipping the provider detection feature.

## Scope

- [ ] Add fixture-based parity tests for the generated registry and its
      Universal/non-Universal grouping.
- [ ] Add Rust tests for macOS/Windows detection and global path resolution.
- [ ] Add shared React tests for provider ordering, counts, warnings, card tag
      merging, alphabetical skills, deduplication, toggle reset, Universal section
      placement, and Rescan refresh behavior.
- [ ] Test that selecting a provider only filters the existing in-memory scan
      snapshot and performs no additional filesystem read.
- [ ] Test that app-open, Installed Skills activation, and manual Rescan all
      replace one shared snapshot while keeping prior results visible during the
      refresh.
- [ ] Test the desktop reveal-path action and missing-directory disabled state.
- [ ] Test web and mock adapters, including the absence of Tauri imports in the
      web production graph.
- [ ] Run the project quality gate and document any required generated-binding
      or registry-update commands.

## Out of scope

- Project-local skill scanning.
- Auth or credential tests.
- Source-attribution UI placement.

## Done when

- `npm run check:all` passes.
- Registry, scanner, adapters, and UI have deterministic fixture coverage.
- Provider switching is instant after the initial scan.
- Web build remains free of Tauri markers.
