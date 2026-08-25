//! Seam J: serve the installed scan from cache while the filesystem is unchanged.
//!
//! The full walk reads and parses a `SKILL.md` per skill; with plugin skills
//! folded in that is ~350 files and roughly half a second. The Installed tab
//! rescans on every activation, so almost every one of those walks re-derives a
//! snapshot that is byte-identical to the last.
//!
//! Open-knowledge's `file-watcher.ts` solves this with an OS watcher feeding a
//! content-hashed index. This crate has no watcher dependency available, so the
//! same invalidation model is driven by a metadata fingerprint: one pass over
//! the directories the scan reads, hashing entry names, modification times and
//! `SKILL.md` sizes without opening skill content. Provider control files such
//! as Hermes' small `_org/.active_org` marker are read so the fingerprint walks
//! the same active tree as the scanner. The answer is only reused when that
//! fingerprint matches, so an edit made outside the app is picked up on the
//! next scan with no restart.
//!
//! It fails safe: any error while fingerprinting means "unknown state", which
//! falls through to a full walk and stores nothing, rather than serving a stale
//! snapshot indefinitely.

use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{LazyLock, Mutex};
use std::time::UNIX_EPOCH;

use super::paths::{
    evaluate_detection, load_registry, resolve_global_skills_dir, universal_skills_dir,
};
use super::plugin_manifest::read_installed_plugins;
use super::scan::{scan_installed, walk_provider_skill_entries, ScanContext};
use super::types::InstalledScanSnapshot;

/// Nanoseconds since the epoch, or `0` for a time the platform cannot express.
/// Zero is a fine stand-in: it only has to be stable and to change when the
/// timestamp does.
fn mtime_nanos(meta: &fs::Metadata) -> u128 {
    meta.modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|since| since.as_nanos())
        .unwrap_or(0)
}

/// Hash one path's stat data. A missing path hashes distinctly from a present
/// one, so appearance and disappearance both register.
fn hash_path_stat(hasher: &mut DefaultHasher, path: &Path) {
    path.to_string_lossy().hash(hasher);
    match fs::symlink_metadata(path) {
        Ok(meta) => {
            true.hash(hasher);
            meta.len().hash(hasher);
            mtime_nanos(&meta).hash(hasher);
            meta.file_type().is_dir().hash(hasher);
            meta.file_type().is_symlink().hash(hasher);
        }
        Err(_) => false.hash(hasher),
    }
}

/// Hash a skills directory: the directory itself, then every non-hidden entry
/// and its `SKILL.md`.
///
/// A skills folder's own mtime moves when a skill is added or removed, but an
/// in-place content edit only touches `SKILL.md`, so that file is stated too.
/// Symlinked skills are stated through to their target, matching the scan.
fn hash_skills_dir(hasher: &mut DefaultHasher, dir: &Path) {
    hash_path_stat(hasher, dir);

    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };

    // read_dir order is filesystem-defined; sort so the hash is stable.
    let mut names: Vec<std::ffi::OsString> = entries
        .flatten()
        .map(|entry| entry.file_name())
        .filter(|name| !name.to_string_lossy().starts_with('.'))
        .collect();
    names.sort();

    for name in names {
        let entry_path = dir.join(&name);
        hash_path_stat(hasher, &entry_path);
        // Follows the symlink, unlike hash_path_stat, because the SKILL.md the
        // scan parses is the one in the resolved target.
        match fs::metadata(entry_path.join("SKILL.md")) {
            Ok(meta) => {
                true.hash(hasher);
                meta.len().hash(hasher);
                mtime_nanos(&meta).hash(hasher);
            }
            Err(_) => false.hash(hasher),
        }
    }
}

fn hash_provider_skills_dir(hasher: &mut DefaultHasher, dir: &Path, provider_id: &str) {
    hash_path_stat(hasher, dir);
    let walk = walk_provider_skill_entries(dir, provider_id);
    for control_path in walk.control_paths {
        hash_path_stat(hasher, &control_path);
    }
    for entry in walk.entries {
        hash_path_stat(hasher, &entry.entry_path);
        hash_path_stat(hasher, &entry.content_root.join("SKILL.md"));
    }
}

/// A metadata digest of every input `scan_installed` reads, plus the small
/// provider control files needed to select the same tree.
///
/// Deliberately re-derives provider detection: a provider that becomes detected
/// changes the snapshot even when no skills directory moved.
fn fingerprint(ctx: &ScanContext) -> Result<u64, String> {
    let registry = load_registry()?;
    let universal_dir = universal_skills_dir(&registry, &ctx.probe)?;

    let mut hasher = DefaultHasher::new();
    ctx.include_internal.hash(&mut hasher);
    hash_skills_dir(&mut hasher, &universal_dir);

    for provider in &registry.providers {
        let detected = evaluate_detection(&provider.detection, &ctx.probe);
        provider.id.hash(&mut hasher);
        detected.hash(&mut hasher);
        if !detected {
            continue;
        }
        let skills_dir = resolve_global_skills_dir(&provider.global_skills_dir, &ctx.probe);
        match skills_dir {
            Some(dir) if dir != universal_dir => {
                hash_provider_skills_dir(&mut hasher, &dir, &provider.id)
            }
            // A provider sharing the Universal tree adds no directory of its
            // own; the Universal hash above already covers it.
            other => other.is_some().hash(&mut hasher),
        }
    }

    let plugins_dir = ctx.probe.home.join(".claude").join("plugins");
    hash_path_stat(&mut hasher, &plugins_dir.join("installed_plugins.json"));
    for install in read_installed_plugins(&plugins_dir).installs {
        install.plugin.hash(&mut hasher);
        install.version.hash(&mut hasher);
        hash_skills_dir(&mut hasher, &install.install_path.join("skills"));
    }

    Ok(hasher.finish())
}

/// One cached snapshot plus the fingerprint it was taken at.
#[derive(Default)]
pub struct ScanCache {
    entry: Mutex<Option<(u64, InstalledScanSnapshot)>>,
    hits: AtomicU64,
}

impl ScanCache {
    /// Return the cached snapshot when the filesystem fingerprint is unchanged,
    /// otherwise walk and store. A fingerprint that cannot be computed drops
    /// through to an uncached walk and clears any stale entry.
    pub fn scan(&self, ctx: &ScanContext) -> Result<InstalledScanSnapshot, String> {
        let Ok(current) = fingerprint(ctx) else {
            self.invalidate();
            return scan_installed(ctx);
        };

        // Held across the walk so two concurrent scans do one walk, not two.
        let mut entry = self.lock();
        if let Some((cached_fingerprint, snapshot)) = entry.as_ref() {
            if *cached_fingerprint == current {
                self.hits.fetch_add(1, Ordering::Relaxed);
                return Ok(snapshot.clone());
            }
        }

        let snapshot = scan_installed(ctx)?;
        *entry = Some((current, snapshot.clone()));
        Ok(snapshot)
    }

    fn invalidate(&self) {
        *self.lock() = None;
    }

    /// Recover from poisoning rather than propagating it: a panic mid-walk must
    /// cost one stale entry, not brick every later scan in the process.
    fn lock(&self) -> std::sync::MutexGuard<'_, Option<(u64, InstalledScanSnapshot)>> {
        self.entry.lock().unwrap_or_else(|e| e.into_inner())
    }

    /// How many scans were answered without a walk. Exists for the tests that
    /// grade "a repeat scan does not re-walk".
    #[cfg(test)]
    pub fn hits(&self) -> u64 {
        self.hits.load(Ordering::Relaxed)
    }
}

static SCAN_CACHE: LazyLock<ScanCache> = LazyLock::new(ScanCache::default);

/// Process-wide cached entry point for the `scan_installed_skills` command.
pub fn scan_installed_cached(ctx: &ScanContext) -> Result<InstalledScanSnapshot, String> {
    SCAN_CACHE.scan(ctx)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::provider_scan::paths::ProbeContext;
    use std::path::PathBuf;
    use std::time::SystemTime;

    fn write_skill(dir: &Path, folder: &str, description: &str) {
        let skill_dir = dir.join(folder);
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(
            skill_dir.join("SKILL.md"),
            format!("---\nname: {folder}\ndescription: {description}\n---\nbody\n"),
        )
        .unwrap();
    }

    fn temp_home(label: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let home = std::env::temp_dir().join(format!("skilltopia-scan-cache-{label}-{unique}"));
        fs::create_dir_all(&home).unwrap();
        home
    }

    fn scan_ctx(home: &Path) -> ScanContext {
        ScanContext {
            probe: ProbeContext {
                home: home.to_path_buf(),
                cwd: home.to_path_buf(),
                platform: "darwin".into(),
                env: std::collections::HashMap::new(),
            },
            include_internal: false,
            scanned_at: Some("2026-01-01T00:00:00Z".into()),
        }
    }

    /// The scan reads `SKILL.md` bodies; the fingerprint must not, or it buys
    /// nothing over the walk it replaces.
    #[test]
    fn fingerprint_is_stable_when_nothing_changes() {
        let home = temp_home("stable");
        let universal = home.join(".agents/skills");
        write_skill(&universal, "alpha", "first");
        let ctx = scan_ctx(&home);

        assert_eq!(fingerprint(&ctx).unwrap(), fingerprint(&ctx).unwrap());
        fs::remove_dir_all(&home).ok();
    }

    #[test]
    fn fingerprint_changes_when_a_skill_is_added_or_removed() {
        let home = temp_home("add-remove");
        let universal = home.join(".agents/skills");
        write_skill(&universal, "alpha", "first");
        let ctx = scan_ctx(&home);
        let before = fingerprint(&ctx).unwrap();

        write_skill(&universal, "beta", "second");
        let with_beta = fingerprint(&ctx).unwrap();
        assert_ne!(before, with_beta);

        fs::remove_dir_all(universal.join("beta")).unwrap();
        assert_ne!(with_beta, fingerprint(&ctx).unwrap());
        fs::remove_dir_all(&home).ok();
    }

    /// An in-place edit leaves the parent directory's mtime alone on most
    /// filesystems, so this is the case a directory-only fingerprint misses.
    #[test]
    fn fingerprint_changes_when_a_skill_md_is_edited_in_place() {
        let home = temp_home("edit");
        let universal = home.join(".agents/skills");
        write_skill(&universal, "alpha", "first");
        let ctx = scan_ctx(&home);
        let before = fingerprint(&ctx).unwrap();

        write_skill(&universal, "alpha", "first, but rewritten at length");
        assert_ne!(before, fingerprint(&ctx).unwrap());
        fs::remove_dir_all(&home).ok();
    }

    #[test]
    fn nested_hermes_skill_edit_invalidates_cached_scan() {
        let home = temp_home("hermes-nested-edit");
        let category = home.join(".hermes/skills/mlops/inference");
        write_skill(&category, "serving-llms-vllm", "first");
        let ctx = scan_ctx(&home);
        let cache = ScanCache::default();
        let before = cache.scan(&ctx).unwrap();
        assert!(before
            .skills
            .iter()
            .any(|skill| skill.description == "first"));

        write_skill(
            &category,
            "serving-llms-vllm",
            "first, but rewritten at length",
        );

        let after = cache.scan(&ctx).unwrap();
        assert_eq!(cache.hits(), 0, "a nested edit must not be a cache hit");
        assert!(after
            .skills
            .iter()
            .any(|skill| skill.description == "first, but rewritten at length"));
        fs::remove_dir_all(&home).ok();
    }

    #[test]
    fn changing_active_hermes_org_invalidates_cached_scan() {
        let home = temp_home("hermes-active-org");
        let org_root = home.join(".hermes/skills/_org");
        write_skill(&org_root.join("first-org"), "first-skill", "First org");
        write_skill(&org_root.join("second-org"), "second-skill", "Second org");
        fs::write(org_root.join(".active_org"), "first-org\n").unwrap();
        let ctx = scan_ctx(&home);
        let cache = ScanCache::default();

        let first = cache.scan(&ctx).unwrap();
        assert!(first.skills.iter().any(|skill| skill.name == "first-skill"));
        assert!(!first
            .skills
            .iter()
            .any(|skill| skill.name == "second-skill"));

        fs::write(org_root.join(".active_org"), "second-org\n").unwrap();
        let second = cache.scan(&ctx).unwrap();

        assert_eq!(cache.hits(), 0, "an org change must not be a cache hit");
        assert!(!second
            .skills
            .iter()
            .any(|skill| skill.name == "first-skill"));
        assert!(second
            .skills
            .iter()
            .any(|skill| skill.name == "second-skill"));
        fs::remove_dir_all(&home).ok();
    }

    #[test]
    fn repeat_scan_is_served_without_walking_again() {
        let home = temp_home("hit");
        write_skill(&home.join(".agents/skills"), "alpha", "first");
        let ctx = scan_ctx(&home);
        let cache = ScanCache::default();

        let first = cache.scan(&ctx).unwrap();
        assert_eq!(cache.hits(), 0);

        let second = cache.scan(&ctx).unwrap();
        assert_eq!(cache.hits(), 1);
        assert_eq!(
            first.skills.len(),
            second.skills.len(),
            "the cached snapshot must match the walked one"
        );
        fs::remove_dir_all(&home).ok();
    }

    #[test]
    fn a_skill_added_outside_the_app_is_reflected_on_the_next_scan() {
        let home = temp_home("external");
        let universal = home.join(".agents/skills");
        write_skill(&universal, "alpha", "first");
        let ctx = scan_ctx(&home);
        let cache = ScanCache::default();

        let before = cache.scan(&ctx).unwrap().skills.len();
        write_skill(&universal, "beta", "second");

        let after = cache.scan(&ctx).unwrap();
        assert_eq!(cache.hits(), 0, "a changed tree must not be a cache hit");
        assert_eq!(after.skills.len(), before + 1);
        fs::remove_dir_all(&home).ok();
    }

    /// Grades the ticket's two timing criteria against the real machine, which
    /// is why it is ignored by default: `cargo test -- --ignored --nocapture`.
    #[test]
    #[ignore]
    fn measures_cold_and_warm_scan_against_the_real_home() {
        let ctx = ScanContext::from_environment();
        let cache = ScanCache::default();

        let cold = std::time::Instant::now();
        let snapshot = cache.scan(&ctx).unwrap();
        let cold = cold.elapsed();

        let warm = std::time::Instant::now();
        cache.scan(&ctx).unwrap();
        let warm = warm.elapsed();

        println!(
            "{} skills / {} providers: cold {cold:?}, warm {warm:?}",
            snapshot.skills.len(),
            snapshot.providers.len()
        );
        assert_eq!(cache.hits(), 1);
    }

    #[test]
    fn plugin_skill_changes_invalidate_the_cache() {
        let home = temp_home("plugin");
        let install = home.join(".claude/plugins/cache/acme/demo");
        write_skill(&install.join("skills"), "gamma", "from a plugin");
        let plugins_dir = home.join(".claude/plugins");
        fs::create_dir_all(&plugins_dir).unwrap();
        fs::write(
            plugins_dir.join("installed_plugins.json"),
            format!(
                r#"{{"version":2,"plugins":{{"demo@acme":[{{"scope":"user","installPath":"{}","version":"1.0.0","lastUpdated":"2026-01-01T00:00:00Z"}}]}}}}"#,
                install.to_string_lossy()
            ),
        )
        .unwrap();
        let ctx = scan_ctx(&home);
        let before = fingerprint(&ctx).unwrap();

        write_skill(&install.join("skills"), "delta", "a second plugin skill");
        assert_ne!(before, fingerprint(&ctx).unwrap());
        fs::remove_dir_all(&home).ok();
    }
}
