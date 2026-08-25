//! Seam I: the plugin cache is read-only, enforced where every write passes.
//!
//! `~/.claude/plugins` belongs to the Claude plugin manager, which overwrites
//! and garbage-collects it on its own schedule. A write we make there is both
//! destructive (it clobbers content we do not own) and futile (the next plugin
//! sync erases it). So the refusal lives in Rust, at the projection seam, not
//! in the UI — a guard one new caller can bypass is not a guard.
//!
//! A plugin skill may still be a copy *source*; only destinations are refused.

use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};

use crate::utils::platform::normalize_path_for_serialization;

use super::plugin_manifest::read_installed_plugins;
use super::scan::ScanContext;

/// Stable marker the UI matches on, mirroring `git_runtime_not_found`. The
/// prose after it is detail; this is the part TypeScript is allowed to branch
/// on, so a reworded message never silently loses its translated toast.
pub(crate) const PLUGIN_MANAGED_CODE: &str = "plugin_managed_read_only";

/// One off-limits root: an active plugin install, or the plugin cache itself.
#[derive(Debug, Clone)]
struct GuardedRoot {
    /// `<plugin>@<marketplace>` when the manifest names one. `None` for the
    /// plugins directory as a whole, which covers garbage-collected versions
    /// and anything the manifest no longer lists.
    label: Option<String>,
    root: PathBuf,
}

/// Refuses writes under the Claude plugin cache, naming the owning plugin.
#[derive(Debug, Clone)]
pub(crate) struct PluginGuard {
    roots: Vec<GuardedRoot>,
}

impl PluginGuard {
    pub(crate) fn for_context(ctx: &ScanContext) -> Self {
        Self::for_home(&ctx.probe.home)
    }

    pub(crate) fn for_home(home: &Path) -> Self {
        let plugins_dir = home.join(".claude").join("plugins");
        let mut roots = vec![GuardedRoot {
            label: None,
            root: resolve_deepest_existing(&plugins_dir),
        }];
        for install in read_installed_plugins(&plugins_dir).installs {
            roots.push(GuardedRoot {
                label: Some(match install.marketplace.as_deref() {
                    Some(marketplace) if !marketplace.is_empty() => {
                        format!("{}@{marketplace}", install.plugin)
                    }
                    _ => install.plugin.clone(),
                }),
                root: resolve_deepest_existing(&install.install_path),
            });
        }
        Self { roots }
    }

    /// The plugin owning `path`, most specific root first so an install inside
    /// the cache wins over the cache itself and can be named.
    fn owner_of(&self, path: &Path) -> Option<&GuardedRoot> {
        let target = resolve_deepest_existing(path);
        self.roots
            .iter()
            .filter(|guarded| target.starts_with(&guarded.root))
            .max_by_key(|guarded| guarded.root.components().count())
    }

    /// The plugin label owning `path`, when one is known.
    pub(crate) fn owning_plugin(&self, path: &Path) -> Option<String> {
        self.owner_of(path)?.label.clone()
    }

    /// `Err` when `path` is inside the plugin cache. The reason names the
    /// owning plugin so the UI can tell the user where the skill is managed,
    /// rather than reporting a generic failure.
    pub(crate) fn refuse_write(&self, path: &Path) -> Result<(), String> {
        let Some(guarded) = self.owner_of(path) else {
            return Ok(());
        };
        let where_managed = match &guarded.label {
            Some(label) => format!("the Claude plugin '{label}'"),
            None => "the Claude plugin cache".to_string(),
        };
        Err(format!(
            "{PLUGIN_MANAGED_CODE}: '{}' is managed by {where_managed} and cannot be changed here",
            normalize_path_for_serialization(path)
        ))
    }
}

/// Canonicalize the deepest existing ancestor of `path` and re-append the rest.
///
/// A projection destination usually does not exist yet, so `canonicalize` on
/// the path itself fails. Resolving the ancestor still strips the symlinks that
/// would otherwise let a link into the plugin cache walk past a lexical check.
fn resolve_deepest_existing(path: &Path) -> PathBuf {
    let mut suffix: Vec<OsString> = Vec::new();
    let mut cursor = path.to_path_buf();
    loop {
        if let Ok(real) = fs::canonicalize(&cursor) {
            let mut resolved = real;
            for segment in suffix.iter().rev() {
                resolved.push(segment);
            }
            return resolved;
        }
        let Some(name) = cursor.file_name().map(OsString::from) else {
            return path.to_path_buf();
        };
        suffix.push(name);
        if !cursor.pop() {
            return path.to_path_buf();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_home(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "skilltopia-guard-{label}-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// One active plugin install, manifest included. Returns the install path.
    fn write_plugin(home: &Path, key: &str, skill: &str) -> PathBuf {
        let install = home
            .join(".claude/plugins/cache")
            .join(key.replace('@', "-"));
        let skill_dir = install.join("skills").join(skill);
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(
            skill_dir.join("SKILL.md"),
            format!("---\nname: {skill}\ndescription: From a plugin\n---\n"),
        )
        .unwrap();
        fs::create_dir_all(home.join(".claude/plugins")).unwrap();
        fs::write(
            home.join(".claude/plugins/installed_plugins.json"),
            format!(
                r#"{{"version":2,"plugins":{{"{key}":[{{"scope":"user","installPath":"{}","lastUpdated":"2026-01-01T00:00:00.000Z"}}]}}}}"#,
                install.to_string_lossy().replace('\\', "\\\\")
            ),
        )
        .unwrap();
        install
    }

    #[test]
    fn refuses_a_destination_inside_a_plugin_install_and_names_it() {
        let home = temp_home("named");
        let install = write_plugin(&home, "ponytail@official", "ponytail");

        let guard = PluginGuard::for_home(&home);
        let err = guard
            .refuse_write(&install.join("skills/ponytail"))
            .unwrap_err();
        assert!(err.contains(PLUGIN_MANAGED_CODE), "{err}");
        assert!(err.contains("ponytail@official"), "{err}");
    }

    #[test]
    fn refuses_anywhere_under_the_plugins_dir_even_without_a_manifest_entry() {
        let home = temp_home("orphan");
        write_plugin(&home, "ponytail@official", "ponytail");

        let guard = PluginGuard::for_home(&home);
        // A garbage-collected version the manifest no longer lists.
        let stale = home.join(".claude/plugins/cache/stale-1.0.0/skills/gone");
        let err = guard.refuse_write(&stale).unwrap_err();
        assert!(err.contains(PLUGIN_MANAGED_CODE), "{err}");
        assert!(err.contains("plugin cache"), "{err}");
    }

    #[test]
    fn a_path_that_does_not_exist_yet_is_still_refused() {
        let home = temp_home("absent-dest");
        let install = write_plugin(&home, "ponytail@official", "ponytail");
        let dest = install.join("skills/not-created-yet");
        assert!(!dest.exists());
        assert!(guard_err(&home, &dest).contains(PLUGIN_MANAGED_CODE));
    }

    #[test]
    fn a_symlink_into_the_cache_cannot_walk_past_the_check() {
        let home = temp_home("symlinked");
        let install = write_plugin(&home, "ponytail@official", "ponytail");
        let alias = home.join("alias");
        #[cfg(unix)]
        std::os::unix::fs::symlink(install.join("skills"), &alias).unwrap();
        #[cfg(windows)]
        std::os::windows::fs::symlink_dir(install.join("skills"), &alias).unwrap();

        assert!(guard_err(&home, &alias.join("ponytail")).contains(PLUGIN_MANAGED_CODE));
    }

    #[test]
    fn an_ordinary_skills_directory_is_allowed() {
        let home = temp_home("allowed");
        write_plugin(&home, "ponytail@official", "ponytail");
        let guard = PluginGuard::for_home(&home);
        assert!(guard
            .refuse_write(&home.join(".agents/skills/demo"))
            .is_ok());
        assert!(guard
            .refuse_write(&home.join(".claude/skills/demo"))
            .is_ok());
    }

    #[test]
    fn owning_plugin_names_the_install_and_is_none_elsewhere() {
        let home = temp_home("owner");
        let install = write_plugin(&home, "ponytail@official", "ponytail");
        let guard = PluginGuard::for_home(&home);
        assert_eq!(
            guard.owning_plugin(&install.join("skills/ponytail")),
            Some("ponytail@official".into())
        );
        assert_eq!(guard.owning_plugin(&home.join(".agents/skills/demo")), None);
    }

    fn guard_err(home: &Path, path: &Path) -> String {
        PluginGuard::for_home(home).refuse_write(path).unwrap_err()
    }
}

/// The criterion this seam exists for: **no write path reaches the plugin
/// cache**. Each test drives a real public entry point at a destination that
/// resolves inside the cache and asserts two things — the call is refused with
/// a reason naming the plugin, and the plugin tree is byte-for-byte unchanged.
///
/// A guard asserted only at the `PluginGuard` unit level would pass while a new
/// caller bypassed it, so these go through `install_skill`, `uninstall_skill`,
/// `copy_skill_to_providers` and `delete_universal_skill_dir` as the UI does.
#[cfg(test)]
mod no_writes_reach_the_plugin_cache {
    use super::super::copy::{copy_skill_to_providers, CopyProviderStatus};
    use super::super::install::{install_skill, uninstall_skill, SkillTargetStatus};
    use super::super::paths::ProbeContext;
    use super::super::scan::{delete_universal_skill_dir, ScanContext};
    use super::*;
    use std::collections::HashMap;
    use std::time::{SystemTime, UNIX_EPOCH};

    /// Home laid out so that *every* destination the app can compute resolves
    /// into the plugin cache: Universal and both provider roots are symlinks
    /// into it. Nothing short of the Rust guard stands between a write and the
    /// plugin's own files.
    struct Booby {
        home: PathBuf,
        plugins_dir: PathBuf,
        install: PathBuf,
    }

    fn booby_trapped_home(label: &str) -> Booby {
        let home = std::env::temp_dir().join(format!(
            "skilltopia-nowrite-{label}-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        let install = home.join(".claude/plugins/cache/ponytail-official");
        for skill in ["ponytail", "shared"] {
            let dir = install.join("skills").join(skill);
            fs::create_dir_all(&dir).unwrap();
            fs::write(
                dir.join("SKILL.md"),
                format!("---\nname: {skill}\ndescription: Shipped by a plugin\n---\n\n# {skill}\n"),
            )
            .unwrap();
        }
        let plugins_dir = home.join(".claude/plugins");
        fs::write(
            plugins_dir.join("installed_plugins.json"),
            format!(
                r#"{{"version":2,"plugins":{{"ponytail@official":[{{"scope":"user","installPath":"{}","version":"1.2.0","lastUpdated":"2026-01-01T00:00:00.000Z"}}]}}}}"#,
                install.to_string_lossy().replace('\\', "\\\\")
            ),
        )
        .unwrap();

        // Point every writable root at the plugin's own skills directory.
        let cache_skills = install.join("skills");
        for root in [".agents/skills", ".claude/skills", ".codex/skills"] {
            let link = home.join(root);
            fs::create_dir_all(link.parent().unwrap()).unwrap();
            #[cfg(unix)]
            std::os::unix::fs::symlink(&cache_skills, &link).unwrap();
            #[cfg(windows)]
            std::os::windows::fs::symlink_dir(&cache_skills, &link).unwrap();
        }

        Booby {
            home,
            plugins_dir,
            install,
        }
    }

    fn ctx(home: &Path) -> ScanContext {
        ScanContext {
            probe: ProbeContext {
                home: home.to_path_buf(),
                cwd: home.to_path_buf(),
                platform: "darwin".into(),
                env: HashMap::new(),
            },
            include_internal: false,
            scanned_at: Some("test-time".into()),
        }
    }

    /// Path, entry kind and bytes for everything under the plugins directory.
    /// Symlinks are recorded by their target and never followed, so a write
    /// *through* one still shows up as changed content at the far end.
    fn digest(root: &Path) -> Vec<String> {
        let mut out = Vec::new();
        let mut stack = vec![root.to_path_buf()];
        while let Some(dir) = stack.pop() {
            let Ok(entries) = fs::read_dir(&dir) else {
                continue;
            };
            for entry in entries.flatten() {
                let path = entry.path();
                let meta = fs::symlink_metadata(&path).unwrap();
                let rel = path
                    .strip_prefix(root)
                    .unwrap()
                    .to_string_lossy()
                    .to_string();
                if meta.file_type().is_symlink() {
                    out.push(format!("link {rel} -> {:?}", fs::read_link(&path).unwrap()));
                } else if meta.is_dir() {
                    out.push(format!("dir  {rel}"));
                    stack.push(path);
                } else {
                    out.push(format!("file {rel} {:?}", fs::read(&path).unwrap()));
                }
            }
        }
        out.sort();
        out
    }

    /// Run `exercise` against the trapped home and fail if it touched anything
    /// under the plugin cache.
    fn assert_untouched(label: &str, exercise: impl FnOnce(&Booby, &ScanContext)) {
        let booby = booby_trapped_home(label);
        let context = ctx(&booby.home);
        let before = digest(&booby.plugins_dir);
        assert!(!before.is_empty(), "fixture wrote no plugin files");

        exercise(&booby, &context);

        assert_eq!(
            digest(&booby.plugins_dir),
            before,
            "a write reached the plugin cache"
        );
    }

    #[test]
    #[cfg(any(unix, windows))]
    fn install_is_refused_when_the_universal_root_resolves_into_the_cache() {
        assert_untouched("install", |booby, context| {
            let repo = booby.home.join("origin");
            let skill = repo.join("skills/ponytail");
            fs::create_dir_all(&skill).unwrap();
            fs::write(
                skill.join("SKILL.md"),
                "---\nname: ponytail\ndescription: A demo skill\n---\n\n# ponytail\n",
            )
            .unwrap();
            for args in [
                vec!["init", "--quiet", "-b", "main"],
                vec!["config", "user.email", "test@example.com"],
                vec!["config", "user.name", "Test"],
                vec!["add", "-A"],
                vec!["commit", "--quiet", "-m", "seed"],
            ] {
                let out = std::process::Command::new("git")
                    .args(&args)
                    .current_dir(&repo)
                    .output()
                    .unwrap();
                assert!(out.status.success(), "git {args:?} failed");
            }

            let err = install_skill(
                &format!("file://{}", repo.display()),
                "ponytail",
                &["claude-code".into(), "codex".into()],
                None,
                &booby.home.join("cache"),
                context,
            )
            .unwrap_err();
            assert!(err.contains(PLUGIN_MANAGED_CODE), "{err}");
            assert!(err.contains("ponytail@official"), "{err}");
        });
    }

    #[test]
    #[cfg(any(unix, windows))]
    fn uninstall_is_refused_for_every_target_that_resolves_into_the_cache() {
        assert_untouched("uninstall", |_, context| {
            let result = uninstall_skill(
                "ponytail",
                &["universal".into(), "claude-code".into(), "codex".into()],
                context,
            )
            .unwrap();
            assert_eq!(result.results.len(), 3);
            for outcome in &result.results {
                assert_eq!(outcome.status, SkillTargetStatus::Refused);
                let message = outcome.message.as_deref().unwrap_or_default();
                assert!(message.contains(PLUGIN_MANAGED_CODE), "{message}");
                assert!(message.contains("ponytail@official"), "{message}");
            }
        });
    }

    /// The plain case the user actually hits: a skill that exists only because
    /// a plugin ships it. There is nothing here to remove, so refuse outright
    /// and name the plugin rather than reporting a bare "absent".
    #[test]
    fn uninstalling_a_plugin_only_skill_is_refused_by_name() {
        let booby = booby_trapped_home("plugin-only");
        // Untrap the roots: this is an ordinary home with a plugin installed.
        for root in [".agents/skills", ".claude/skills", ".codex/skills"] {
            fs::remove_file(booby.home.join(root)).unwrap();
        }
        let before = digest(&booby.plugins_dir);

        let err = uninstall_skill(
            "ponytail",
            &["universal".into(), "claude-code".into(), "codex".into()],
            &ctx(&booby.home),
        )
        .unwrap_err();

        assert!(err.contains(PLUGIN_MANAGED_CODE), "{err}");
        assert!(err.contains("ponytail@official"), "{err}");
        assert_eq!(digest(&booby.plugins_dir), before);
    }

    /// A skill that also lives in a directory the user owns still uninstalls
    /// from there. Refusing outright would break a legitimate removal.
    #[test]
    fn uninstalling_a_skill_the_user_also_owns_still_removes_their_copy() {
        let booby = booby_trapped_home("also-owned");
        for root in [".agents/skills", ".claude/skills", ".codex/skills"] {
            fs::remove_file(booby.home.join(root)).unwrap();
        }
        let owned = booby.home.join(".agents/skills/shared");
        fs::create_dir_all(&owned).unwrap();
        fs::write(
            owned.join("SKILL.md"),
            "---\nname: shared\ndescription: Mine\n---\n",
        )
        .unwrap();
        let before = digest(&booby.plugins_dir);

        let result = uninstall_skill("shared", &["universal".into()], &ctx(&booby.home)).unwrap();

        assert_eq!(result.results[0].status, SkillTargetStatus::Removed);
        assert!(!owned.exists());
        assert_eq!(digest(&booby.plugins_dir), before);
    }

    #[test]
    #[cfg(any(unix, windows))]
    fn copy_into_a_provider_that_resolves_into_the_cache_is_refused() {
        assert_untouched("copy-dest", |_, context| {
            let result = copy_skill_to_providers(
                "ponytail",
                &["claude-code".into(), "codex".into()],
                context,
            )
            .unwrap();
            for outcome in &result.results {
                assert_eq!(
                    outcome.status,
                    CopyProviderStatus::Refused,
                    "{:?}",
                    outcome.message
                );
                let message = outcome.message.as_deref().unwrap_or_default();
                assert!(message.contains(PLUGIN_MANAGED_CODE), "{message}");
                assert!(message.contains("ponytail@official"), "{message}");
            }
        });
    }

    #[test]
    #[cfg(any(unix, windows))]
    fn deleting_the_universal_folder_is_refused_when_it_resolves_into_the_cache() {
        assert_untouched("delete-universal", |_, context| {
            let err = delete_universal_skill_dir("ponytail", context).unwrap_err();
            assert!(err.contains(PLUGIN_MANAGED_CODE), "{err}");
            assert!(err.contains("ponytail@official"), "{err}");
        });
    }

    /// The read side stays open: a plugin skill copied into a provider
    /// directory the user owns is the supported way to adopt one.
    #[test]
    fn copying_from_a_plugin_skill_into_a_real_provider_dir_still_works() {
        let booby = booby_trapped_home("copy-source");
        // Untrap every root: an ordinary home, where the only copy of
        // `ponytail` is the one the plugin ships.
        for root in [".agents/skills", ".claude/skills", ".codex/skills"] {
            fs::remove_file(booby.home.join(root)).unwrap();
        }
        let codex = booby.home.join(".codex/skills");
        fs::create_dir_all(&codex).unwrap();
        let before = digest(&booby.plugins_dir);

        let result =
            copy_skill_to_providers("ponytail", &["codex".into()], &ctx(&booby.home)).unwrap();

        assert_eq!(
            result.results[0].status,
            CopyProviderStatus::Copied,
            "{:?}",
            result.results[0].message
        );
        assert_eq!(
            fs::read_link(codex.join("ponytail")).unwrap(),
            booby.install.join("skills/ponytail")
        );
        assert_eq!(digest(&booby.plugins_dir), before);
    }

    /// A copy the user owns wins over the plugin's. The plugin is the source of
    /// last resort, never a silent override of what they installed themselves.
    #[test]
    fn a_users_own_copy_is_preferred_over_the_plugins() {
        let booby = booby_trapped_home("source-order");
        for root in [".agents/skills", ".claude/skills", ".codex/skills"] {
            fs::remove_file(booby.home.join(root)).unwrap();
        }
        let universal = booby.home.join(".agents/skills/shared");
        fs::create_dir_all(&universal).unwrap();
        fs::write(
            universal.join("SKILL.md"),
            "---\nname: shared\ndescription: Mine\n---\n",
        )
        .unwrap();
        fs::create_dir_all(booby.home.join(".codex/skills")).unwrap();

        copy_skill_to_providers("shared", &["codex".into()], &ctx(&booby.home)).unwrap();

        assert_eq!(
            fs::read_link(booby.home.join(".codex/skills/shared")).unwrap(),
            universal
        );
    }
}
