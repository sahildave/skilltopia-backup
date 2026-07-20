# Desktop Provider Scan

Global installed-skill discovery for the desktop adapter.

## Flow

1. React calls `platform.getInstalledScan()` / `scanInstalled()` on `@platform`.
2. Desktop adapter invokes typed Tauri commands (`scanInstalledSkills`,
   `revealProviderSkillsDir`) via `@/lib/tauri-bindings`.
3. Rust loads the checked-in `src/providers/registry.json`, detects providers,
   scans Universal (`~/.agents/skills`) and each detected provider’s direct
   global skills directory, and returns one `InstalledScanSnapshot`.

`listInstalled()` and `listProviders()` read the same in-memory snapshot. Call
`scanInstalled()` to replace it (app open / Installed Skills activation /
manual Rescan — wired in the Installed Skills UI task).

## Snapshot contents

- Detected providers (including zero-skill providers) with counts and paths
- Deduplicated skills with provider associations and source paths
- Structured warnings (`provider_empty`, `skills_dir_missing`, `entry_skipped`,
  `universal_empty`)
- Registry source metadata (commit / attribution)

Windows paths are normalized to forward slashes before serialization.

## Reveal

`revealProviderSkillsDir(id)` resolves the directory from the registry (or the
Universal path) and opens Finder/Explorer. It does **not** rescan. Returns
`false` when the directory is missing so UI can disable the action.

## Tests

Rust unit tests live under `src-tauri/src/provider_scan/` (detection, path
resolution, frontmatter, dedupe, Universal attribution, warnings). Mock TARGET
fixtures exercise the snapshot shape for Chrome UI work.
