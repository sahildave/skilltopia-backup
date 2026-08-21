//! Seam F: reader for `~/.claude/plugins/installed_plugins.json`.
//!
//! The manifest, not a `cache/**` glob, is the source of truth. The plugin
//! cache retains garbage-collected duplicate versions — on the machine measured
//! for the epic, `cache/**` held 310 distinct skill names against 265 in the
//! active install paths — so globbing reports stale versions as if they were
//! live. The manifest names the *active* install per site and carries the
//! provenance (version, git commit, scope, marketplace) that a glob cannot.
//!
//! Read-only: the plugin cache is owned by the plugin manager, and nothing here
//! writes to it. Walking an install path and reading SKILL.md is Seam G.

use super::types::{ScanWarning, ScanWarningCode};
use serde::Deserialize;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

const MANIFEST_FILE: &str = "installed_plugins.json";

/// The only manifest schema this reader understands. Anything else degrades to
/// "no plugin skills" plus a warning, never an error that fails the whole scan.
const SUPPORTED_SCHEMA_VERSION: u32 = 2;

/// One active plugin install, with the provenance the manifest carries.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PluginInstall {
    pub plugin: String,
    pub marketplace: Option<String>,
    pub install_path: PathBuf,
    pub version: Option<String>,
    pub git_commit_sha: Option<String>,
    pub scope: Option<String>,
}

/// Active installs plus any warnings raised while reading the manifest.
#[derive(Debug, Default)]
pub struct PluginManifestScan {
    pub installs: Vec<PluginInstall>,
    pub warnings: Vec<ScanWarning>,
}

#[derive(Debug, Deserialize)]
struct Manifest {
    version: Option<u32>,
    #[serde(default)]
    plugins: BTreeMap<String, Vec<ManifestEntry>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManifestEntry {
    scope: Option<String>,
    project_path: Option<String>,
    install_path: Option<String>,
    version: Option<String>,
    git_commit_sha: Option<String>,
    last_updated: Option<String>,
    /// Snake-cased in the real manifest, unlike its neighbours.
    #[serde(rename = "orphaned_at")]
    orphaned_at: Option<String>,
}

/// Split a `<plugin>@<marketplace>` key on the **last** `@` — plugin names may
/// contain one. A leading `@` means the whole key is the plugin name.
fn split_plugin_key(key: &str) -> (String, Option<String>) {
    match key.rfind('@') {
        Some(at) if at > 0 => (key[..at].to_string(), Some(key[at + 1..].to_string())),
        _ => (key.to_string(), None),
    }
}

/// Pick the active entry per `(scope, projectPath)` install site: newest
/// `lastUpdated`, never orphaned, install path present on disk.
fn active_entries(entries: Vec<ManifestEntry>) -> Vec<ManifestEntry> {
    let mut by_site: BTreeMap<(String, String), ManifestEntry> = BTreeMap::new();
    for entry in entries {
        if entry.orphaned_at.is_some() {
            continue;
        }
        let Some(install_path) = entry.install_path.as_deref() else {
            continue;
        };
        if !Path::new(install_path).exists() {
            continue;
        }
        let site = (
            entry.scope.clone().unwrap_or_default(),
            entry.project_path.clone().unwrap_or_default(),
        );
        let newer = match by_site.get(&site) {
            Some(current) => {
                entry.last_updated.as_deref().unwrap_or("")
                    > current.last_updated.as_deref().unwrap_or("")
            }
            None => true,
        };
        if newer {
            by_site.insert(site, entry);
        }
    }
    by_site.into_values().collect()
}

/// Read the plugin manifest under `plugins_dir` (normally `~/.claude/plugins`)
/// and return the active installs. An absent, malformed, or
/// unrecognized-schema manifest yields no installs rather than an error.
pub fn read_installed_plugins(plugins_dir: &Path) -> PluginManifestScan {
    let manifest_path = plugins_dir.join(MANIFEST_FILE);
    let Ok(raw) = std::fs::read_to_string(&manifest_path) else {
        return PluginManifestScan::default();
    };

    let manifest: Manifest = match serde_json::from_str(&raw) {
        Ok(manifest) => manifest,
        Err(err) => {
            // A partial write mid-upgrade erases every plugin-delivered skill;
            // warn so that stays distinguishable from "no plugins installed".
            return PluginManifestScan {
                installs: Vec::new(),
                warnings: vec![manifest_warning(
                    &manifest_path,
                    format!("Could not parse {MANIFEST_FILE}: {err}"),
                )],
            };
        }
    };

    if manifest.version != Some(SUPPORTED_SCHEMA_VERSION) {
        let found = manifest
            .version
            .map(|v| v.to_string())
            .unwrap_or_else(|| "none".into());
        return PluginManifestScan {
            installs: Vec::new(),
            warnings: vec![manifest_warning(
                &manifest_path,
                format!(
                    "Unrecognized {MANIFEST_FILE} schema version {found} (expected {SUPPORTED_SCHEMA_VERSION}); skipping plugin skills"
                ),
            )],
        };
    }

    let installs = manifest
        .plugins
        .into_iter()
        .flat_map(|(key, entries)| {
            let (plugin, marketplace) = split_plugin_key(&key);
            active_entries(entries)
                .into_iter()
                .filter_map(move |entry| {
                    Some(PluginInstall {
                        plugin: plugin.clone(),
                        marketplace: marketplace.clone(),
                        install_path: PathBuf::from(entry.install_path?),
                        version: entry.version,
                        git_commit_sha: entry.git_commit_sha,
                        scope: entry.scope,
                    })
                })
        })
        .collect();

    PluginManifestScan {
        installs,
        warnings: Vec::new(),
    }
}

fn manifest_warning(manifest_path: &Path, message: String) -> ScanWarning {
    ScanWarning {
        code: ScanWarningCode::EntrySkipped,
        message,
        provider_id: None,
        path: Some(manifest_path.to_string_lossy().to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_plugins_dir(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "skilltopia-plugins-{label}-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// Create an install path under `dir` so existence checks pass.
    fn install_path(dir: &Path, name: &str) -> String {
        let path = dir.join("cache").join(name);
        fs::create_dir_all(&path).unwrap();
        path.to_string_lossy().to_string()
    }

    fn write_manifest(dir: &Path, body: &str) {
        fs::write(dir.join(MANIFEST_FILE), body).unwrap();
    }

    #[test]
    fn absent_manifest_yields_no_installs() {
        let dir = temp_plugins_dir("absent");
        let scan = read_installed_plugins(&dir);
        assert!(scan.installs.is_empty());
        assert!(scan.warnings.is_empty());
    }

    #[test]
    fn malformed_manifest_warns_instead_of_failing() {
        let dir = temp_plugins_dir("malformed");
        write_manifest(&dir, "{ not json");
        let scan = read_installed_plugins(&dir);
        assert!(scan.installs.is_empty());
        assert_eq!(scan.warnings.len(), 1);
    }

    #[test]
    fn unrecognized_schema_version_yields_empty_with_warning() {
        let dir = temp_plugins_dir("schema");
        let path = install_path(&dir, "vercel/1.0.0");
        write_manifest(
            &dir,
            &format!(
                r#"{{"version":99,"plugins":{{"vercel@official":[{{"scope":"user","installPath":"{path}","lastUpdated":"2026-01-01T00:00:00.000Z"}}]}}}}"#
            ),
        );
        let scan = read_installed_plugins(&dir);
        assert!(scan.installs.is_empty());
        assert_eq!(scan.warnings.len(), 1);
        assert!(scan.warnings[0].message.contains("99"));
    }

    #[test]
    fn skips_orphaned_and_missing_install_paths() {
        let dir = temp_plugins_dir("skips");
        let live = install_path(&dir, "keep/1.0.0");
        let orphan = install_path(&dir, "orphan/1.0.0");
        let gone = dir
            .join("cache/never-created")
            .to_string_lossy()
            .to_string();
        write_manifest(
            &dir,
            &format!(
                r#"{{"version":2,"plugins":{{
                  "keep@official":[{{"scope":"user","installPath":"{live}","lastUpdated":"2026-01-01T00:00:00.000Z"}}],
                  "orphan@official":[{{"scope":"user","installPath":"{orphan}","lastUpdated":"2026-01-01T00:00:00.000Z","orphaned_at":"2026-02-01T00:00:00.000Z"}}],
                  "nopath@official":[{{"scope":"user","lastUpdated":"2026-01-01T00:00:00.000Z"}}],
                  "stale@official":[{{"scope":"user","installPath":"{gone}","lastUpdated":"2026-01-01T00:00:00.000Z"}}]
                }}}}"#
            ),
        );
        let scan = read_installed_plugins(&dir);
        let plugins: Vec<&str> = scan.installs.iter().map(|i| i.plugin.as_str()).collect();
        assert_eq!(plugins, vec!["keep"]);
        assert!(scan.warnings.is_empty());
    }

    #[test]
    fn picks_newest_last_updated_per_site() {
        let dir = temp_plugins_dir("newest");
        let old = install_path(&dir, "vercel/0.1.0");
        let new = install_path(&dir, "vercel/0.2.0");
        write_manifest(
            &dir,
            &format!(
                r#"{{"version":2,"plugins":{{"vercel@official":[
                  {{"scope":"user","installPath":"{old}","version":"0.1.0","lastUpdated":"2026-01-01T00:00:00.000Z"}},
                  {{"scope":"user","installPath":"{new}","version":"0.2.0","lastUpdated":"2026-03-01T00:00:00.000Z"}}
                ]}}}}"#
            ),
        );
        let scan = read_installed_plugins(&dir);
        assert_eq!(scan.installs.len(), 1);
        assert_eq!(scan.installs[0].version.as_deref(), Some("0.2.0"));
    }

    #[test]
    fn keeps_one_install_per_site() {
        let dir = temp_plugins_dir("sites");
        let path = install_path(&dir, "vercel/0.2.0");
        write_manifest(
            &dir,
            &format!(
                r#"{{"version":2,"plugins":{{"vercel@official":[
                  {{"scope":"user","installPath":"{path}","lastUpdated":"2026-01-01T00:00:00.000Z"}},
                  {{"scope":"project","projectPath":"/tmp/a","installPath":"{path}","lastUpdated":"2026-01-02T00:00:00.000Z"}}
                ]}}}}"#
            ),
        );
        let scan = read_installed_plugins(&dir);
        let scopes: Vec<&str> = scan
            .installs
            .iter()
            .filter_map(|i| i.scope.as_deref())
            .collect();
        assert_eq!(scopes, vec!["project", "user"]);
    }

    #[test]
    fn splits_plugin_key_on_the_last_at() {
        let dir = temp_plugins_dir("key");
        let path = install_path(&dir, "scoped/1.0.0");
        write_manifest(
            &dir,
            &format!(
                r#"{{"version":2,"plugins":{{"@acme/tools@marketplace":[
                  {{"scope":"user","installPath":"{path}","gitCommitSha":"abc123","lastUpdated":"2026-01-01T00:00:00.000Z"}}
                ]}}}}"#
            ),
        );
        let scan = read_installed_plugins(&dir);
        assert_eq!(scan.installs.len(), 1);
        assert_eq!(scan.installs[0].plugin, "@acme/tools");
        assert_eq!(scan.installs[0].marketplace.as_deref(), Some("marketplace"));
        assert_eq!(scan.installs[0].git_commit_sha.as_deref(), Some("abc123"));
    }

    #[test]
    fn key_without_marketplace_keeps_the_whole_name() {
        assert_eq!(split_plugin_key("solo"), ("solo".into(), None));
        assert_eq!(
            split_plugin_key("@acme/tools"),
            ("@acme/tools".into(), None)
        );
    }

    #[test]
    fn reading_writes_nothing_under_the_plugins_dir() {
        let dir = temp_plugins_dir("readonly");
        let path = install_path(&dir, "vercel/0.2.0");
        write_manifest(
            &dir,
            &format!(
                r#"{{"version":2,"plugins":{{"vercel@official":[
                  {{"scope":"user","installPath":"{path}","lastUpdated":"2026-01-01T00:00:00.000Z"}}
                ]}}}}"#
            ),
        );

        let before = tree_snapshot(&dir);
        let scan = read_installed_plugins(&dir);
        assert_eq!(scan.installs.len(), 1);
        assert_eq!(tree_snapshot(&dir), before);
    }

    /// Every path under `dir` with its modified time, for a before/after diff.
    fn tree_snapshot(dir: &Path) -> Vec<(PathBuf, SystemTime)> {
        let mut out = Vec::new();
        let mut stack = vec![dir.to_path_buf()];
        while let Some(current) = stack.pop() {
            for entry in fs::read_dir(&current).unwrap().flatten() {
                let path = entry.path();
                let meta = entry.metadata().unwrap();
                out.push((path.clone(), meta.modified().unwrap()));
                if meta.is_dir() {
                    stack.push(path);
                }
            }
        }
        out.sort();
        out
    }
}
