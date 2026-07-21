# Copy providers: filesystem slice

**Milestone:** mvp  
**Depends on:** [installed-skills-copy-providers-mvp](./task-x-installed-skills-copy-providers-mvp.md)

## Goal

Deliver the complete platform capability for copying one installed skill to multiple providers safely.

## Scope

- [ ] Add the typed `PlatformPort` operation and Tauri command accepting `uninstallName` plus provider IDs.
- [ ] Resolve the source in Rust: Universal first, then a real directory, then a resolved symlink target.
- [ ] Validate skill/provider identifiers and reject missing or ambiguous sources.
- [ ] Create missing provider parent folders and directory symlinks without overwriting existing paths.
- [ ] Return independent `copied`, `conflict`, and `failed` results for each provider, preserving partial success.
- [ ] Add Rust and platform tests for source resolution, missing folders, symlinks, conflicts, and partial success.
- [ ] Regenerate and verify typed bindings.

## Done when

- The desktop platform can safely copy an installed skill to any selected provider set and report each outcome.
