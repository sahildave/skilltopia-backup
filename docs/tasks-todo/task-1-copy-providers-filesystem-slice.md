# Copy providers: filesystem slice

**Milestone:** mvp  
**Depends on:** [installed-skills-copy-providers-mvp](./task-x-installed-skills-copy-providers-mvp.md)

## Goal

Deliver the complete platform capability for copying one installed skill to multiple providers safely.

## Scope

- [x] Add the typed `PlatformPort` operation and Tauri command accepting `uninstallName` plus provider IDs.
- [x] Resolve the source in Rust: Universal first, then a real directory, then a resolved symlink target.
- [x] Validate skill/provider identifiers and reject missing or ambiguous sources.
- [x] Create missing provider parent folders and directory symlinks without overwriting existing paths.
- [x] Return independent `copied`, `conflict`, and `failed` results for each provider, preserving partial success.
- [x] Add Rust and platform tests for source resolution, missing folders, symlinks, conflicts, and partial success.
- [x] Regenerate and verify typed bindings.

## Done when

- The desktop platform can safely copy an installed skill to any selected provider set and report each outcome.
