# Desktop provider and installed-skill scan

**Milestone:** provider-detection

**Depends on:** task-7-provider-registry-sync

## Goal

Implement the global installed-skill scan for macOS and Windows behind the
shared `PlatformPort`, with Rust as the desktop filesystem boundary and typed
Tauri commands for the React client.

## Scope

- [x] Extend the shared port contract with a normalized scan snapshot covering
      providers, valid skills, provider associations, counts, paths, warnings, and
      source metadata.
- [x] Keep `listProviders()` and `listInstalled()` backed by one in-memory scan
      snapshot; replace it on app open, Installed Skills tab activation, and manual
      Rescan.
- [x] Implement upstream-compatible detection in Rust using the generated
      registry, including macOS and Windows path variants.
- [x] Scan global locations only. Do not scan project-local directories.
- [x] Match skills.sh listing rules: directory or directory symlink, required
      `SKILL.md`, upstream-compatible frontmatter parsing, and invalid-entry skip.
- [x] Follow symlinks safely when checking directory entries and deduplicate by
      scope and parsed skill name, preserving all provider associations.
- [x] Treat `~/.agents/skills` as the aggregate Universal location. Provider
      filters use only their direct global skills directory.
- [x] Keep detected providers visible even with zero valid skills and return a
      structured non-blocking warning.
- [x] Add a typed desktop command for revealing a provider skills directory in
      Finder/Explorer without triggering a rescan. Disable the action when the
      directory is missing.
- [x] Normalize serialized Windows paths for the shared frontend contract.
- [x] Keep all Tauri imports and filesystem logic inside the desktop adapter and
      Rust command boundary.

## Out of scope

- Project-local skills.
- Authentication, executable/version checks, or PATH probing.
- Creating missing provider directories during scanning.
- Installing, updating, or removing skills.

## Done when

- A desktop scan returns one normalized snapshot for macOS and Windows.
- Provider selection can filter without new filesystem I/O or loading.
- Empty/partial scans produce structured warnings while valid results remain
  usable.
- Reveal-in-file-manager works without rescanning.
- Rust unit tests cover detection, path resolution, parsing, deduplication,
  Universal attribution, and warnings.
