//! Install and uninstall a skill in-process, across every selected target.
//!
//! This is the caller Seam C (acquisition) and Seam D (projection) were built
//! for. `npx skills add` cloned the source repository on every install and
//! `npx skills remove` cost ~1.4 s *per provider, sequentially* — 64 detected
//! providers projected to ~90 s of subprocess spawning to delete some symlinks.
//! Nothing here spawns a subprocess.
//!
//! Shape of an install:
//!
//! 1. acquire the source into the content-addressed cache (a second install of
//!    an unchanged source never touches the network),
//! 2. gate the bundle — a half-merged `SKILL.md` must not land in an agent's
//!    live context,
//! 3. **copy** it into the Universal root: the cache is app-owned and may be
//!    pruned, so the canonical bundle has to hold its own bytes,
//! 4. **symlink** every provider root at that Universal copy, so editing one
//!    bundle updates every agent.

use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use specta::Type;

use crate::skill_acquire::acquire_skill;
use crate::utils::platform::normalize_path_for_serialization;

use super::paths::{load_registry, resolve_global_skills_dir, universal_skills_dir};
use super::projection::{
    project_skill, reverse_project_skill, ForeignDirPolicy, ProjectionMode, ProjectionOutcome,
    ProjectionStatus, ProjectionTarget,
};
use super::scan::{validate_skill_dir_name, ScanContext};
use super::types::UNIVERSAL_PROVIDER_ID;

/// Git conflict markers at line start. A `SKILL.md` carrying one is a
/// half-resolved merge, not a skill.
const CONFLICT_MARKERS: [&str; 3] = ["<<<<<<< ", "=======", ">>>>>>> "];

/// How deep into an acquired repository to look for the skill folder. Skills
/// live at the root, under `skills/`, or one grouping directory further in;
/// past that a same-named folder is far more likely to be a fixture.
const MAX_SKILL_SEARCH_DEPTH: usize = 3;

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SkillTargetStatus {
    /// Linked or copied in.
    Written,
    /// Already correct — including a provider that shares the Universal root.
    AlreadyPresent,
    /// Something we will not delete is in the way.
    Conflict,
    Removed,
    Absent,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SkillTargetResult {
    pub provider_id: String,
    pub status: SkillTargetStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SkillProjectionResult {
    pub results: Vec<SkillTargetResult>,
    /// Answered from the acquisition cache, with no network request. Always
    /// false for an uninstall.
    pub cache_hit: bool,
}

/// Install `skill_name` from `source` into the Universal root and every
/// provider in `provider_ids`.
///
/// `project_path` selects project scope; `None` installs into the home-directory
/// roots. Hard errors are reserved for "there is nothing to install" — a bad
/// source, a missing or invalid bundle, or a Universal root we cannot write.
/// Everything after that is a per-target outcome.
pub fn install_skill(
    source: &str,
    skill_name: &str,
    provider_ids: &[String],
    project_path: Option<&Path>,
    cache_root: &Path,
    ctx: &ScanContext,
) -> Result<SkillProjectionResult, String> {
    validate_skill_dir_name(skill_name)?;

    let acquired = acquire_skill(source, cache_root).map_err(|e| e.to_string())?;
    let bundle = locate_skill_dir(&acquired.bundle_path, skill_name).ok_or_else(|| {
        format!("Source '{source}' does not contain a skill folder named '{skill_name}'")
    })?;
    validate_bundle(&bundle, skill_name)?;

    let universal_root = universal_root_for(project_path, ctx)?;
    let universal_target = ProjectionTarget {
        id: UNIVERSAL_PROVIDER_ID.to_string(),
        root: universal_root.clone(),
    };
    let universal = project_skill(
        &bundle,
        skill_name,
        std::slice::from_ref(&universal_target),
        ProjectionMode::Copy,
        ForeignDirPolicy::Replace,
        project_path,
    );
    let mut results: Vec<SkillTargetResult> = universal.iter().map(to_result).collect();

    // Nothing was written, so there is nothing for the providers to link at.
    if !matches!(
        universal[0].status,
        ProjectionStatus::Written | ProjectionStatus::AlreadyPresent
    ) {
        return Err(universal[0]
            .message
            .clone()
            .unwrap_or_else(|| "Could not write the Universal skill folder".into()));
    }

    let canonical = universal_root.join(skill_name);
    let targets = provider_targets(provider_ids, project_path, ctx)?;
    results.extend(
        project_skill(
            &canonical,
            skill_name,
            &targets.resolved,
            ProjectionMode::Symlink,
            ForeignDirPolicy::Replace,
            project_path,
        )
        .iter()
        .map(to_result),
    );
    results.extend(targets.unresolved);

    Ok(SkillProjectionResult {
        results,
        cache_hit: acquired.cache_hit,
    })
}

/// Remove `uninstall_name` from every id in `target_ids`.
///
/// `universal` is an ordinary id here, so a caller that wants the Universal
/// cleanup puts it in the list — and gets its outcome back independently of
/// whether any provider ahead of it failed.
pub fn uninstall_skill(
    uninstall_name: &str,
    target_ids: &[String],
    ctx: &ScanContext,
) -> Result<SkillProjectionResult, String> {
    validate_skill_dir_name(uninstall_name)?;

    let targets = provider_targets(target_ids, None, ctx)?;
    let mut results: Vec<SkillTargetResult> =
        reverse_project_skill(uninstall_name, &targets.resolved)
            .iter()
            .map(to_result)
            .collect();
    results.extend(targets.unresolved);

    Ok(SkillProjectionResult {
        results,
        cache_hit: false,
    })
}

struct ResolvedTargets {
    resolved: Vec<ProjectionTarget>,
    /// Ids that never resolved to a directory — reported, not silently dropped.
    unresolved: Vec<SkillTargetResult>,
}

/// Resolve every requested id to a skills root, keeping the caller's order and
/// dropping repeats.
fn provider_targets(
    provider_ids: &[String],
    project_path: Option<&Path>,
    ctx: &ScanContext,
) -> Result<ResolvedTargets, String> {
    let registry = load_registry()?;
    let mut resolved = Vec::new();
    let mut unresolved = Vec::new();
    let mut seen = BTreeSet::new();

    for provider_id in provider_ids {
        if !seen.insert(provider_id.clone()) {
            continue;
        }
        if provider_id == UNIVERSAL_PROVIDER_ID {
            resolved.push(ProjectionTarget {
                id: provider_id.clone(),
                root: universal_root_for(project_path, ctx)?,
            });
            continue;
        }
        let Some(provider) = registry.providers.iter().find(|p| &p.id == provider_id) else {
            unresolved.push(SkillTargetResult {
                provider_id: provider_id.clone(),
                status: SkillTargetStatus::Failed,
                message: Some(format!("Unknown provider '{provider_id}'")),
            });
            continue;
        };
        let root = match project_path {
            Some(project) => Some(project.join(&provider.skills_dir)),
            None => resolve_global_skills_dir(&provider.global_skills_dir, &ctx.probe),
        };
        match root {
            Some(root) => resolved.push(ProjectionTarget {
                id: provider_id.clone(),
                root,
            }),
            // A registered provider with no skills directory on this platform
            // has nothing to hold the skill, so it has nothing to remove — not
            // a failure, and it must not colour the caller's error report.
            None => unresolved.push(SkillTargetResult {
                provider_id: provider_id.clone(),
                status: SkillTargetStatus::Absent,
                message: Some(format!(
                    "Provider '{provider_id}' has no skills directory on this platform"
                )),
            }),
        }
    }

    Ok(ResolvedTargets {
        resolved,
        unresolved,
    })
}

fn universal_root_for(project_path: Option<&Path>, ctx: &ScanContext) -> Result<PathBuf, String> {
    let registry = load_registry()?;
    let universal = universal_skills_dir(&registry, &ctx.probe)?;
    Ok(match project_path {
        // `skillsDir` is home-relative for the global roots and project-relative
        // here; `scan_project` reads the project tree the same way.
        Some(project) => project.join(
            registry
                .providers
                .iter()
                .find(|p| p.id == UNIVERSAL_PROVIDER_ID)
                .map(|p| p.skills_dir.as_str())
                .unwrap_or(".agents/skills"),
        ),
        None => universal,
    })
}

fn to_result(outcome: &ProjectionOutcome) -> SkillTargetResult {
    SkillTargetResult {
        provider_id: outcome.target_id.clone(),
        status: match outcome.status {
            ProjectionStatus::Written => SkillTargetStatus::Written,
            ProjectionStatus::AlreadyPresent => SkillTargetStatus::AlreadyPresent,
            ProjectionStatus::Conflict => SkillTargetStatus::Conflict,
            ProjectionStatus::Removed => SkillTargetStatus::Removed,
            ProjectionStatus::Absent => SkillTargetStatus::Absent,
            ProjectionStatus::Failed => SkillTargetStatus::Failed,
        },
        message: outcome.message.clone(),
    }
}

/// Find the folder holding `name`'s bundle inside an acquired repository.
///
/// Breadth-first so the shallowest match wins, and entries are visited in name
/// order, because "the repository happens to contain two folders with this
/// name" must not resolve differently between two runs on the same bytes.
fn locate_skill_dir(repo: &Path, name: &str) -> Option<PathBuf> {
    let mut level = vec![repo.to_path_buf()];
    for _ in 0..=MAX_SKILL_SEARCH_DEPTH {
        for dir in &level {
            let candidate = dir.join(name);
            if candidate.join("SKILL.md").is_file() {
                return Some(candidate);
            }
        }
        level = level.iter().flat_map(|dir| child_dirs(dir)).collect();
        if level.is_empty() {
            break;
        }
    }
    None
}

fn child_dirs(dir: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut dirs: Vec<PathBuf> = entries
        .flatten()
        .filter(|entry| {
            let name = entry.file_name();
            let name = name.to_string_lossy();
            // `.git` alone is ~90% of an acquired repo's entries, and no skill
            // ships from a dot directory or from vendored dependencies.
            !name.starts_with('.')
                && name != "node_modules"
                && entry.file_type().is_ok_and(|t| t.is_dir())
        })
        .map(|entry| entry.path())
        .collect();
    dirs.sort();
    dirs
}

/// The pre-install gate. A source that fails this must not be projected.
///
/// Deliberately not open-knowledge's full gate: it requires
/// `frontmatter.name == <folder>`, where this app treats the folder slug and the
/// display name as distinct all the way through the scan (`uninstallName` vs
/// `name`), so requiring equality here would refuse skills the scanner lists
/// happily.
fn validate_bundle(bundle: &Path, name: &str) -> Result<(), String> {
    let skill_md = bundle.join("SKILL.md");
    let raw = std::fs::read_to_string(&skill_md).map_err(|e| {
        format!(
            "Cannot read '{}': {e}",
            normalize_path_for_serialization(&skill_md)
        )
    })?;

    if raw.lines().any(|line| {
        CONFLICT_MARKERS
            .iter()
            .any(|marker| line.starts_with(marker))
    }) {
        return Err(format!(
            "'{name}' has git conflict markers in SKILL.md — resolve the conflict before installing"
        ));
    }
    if super::frontmatter::parse_skill_md(&raw).is_none() {
        return Err(format!(
            "'{name}' has no valid SKILL.md frontmatter (name and description are required)"
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::super::paths::ProbeContext;
    use super::*;
    use std::collections::HashMap;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_root(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "skilltopia-install-{label}-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn scan_ctx(home: &Path) -> ScanContext {
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

    fn write_skill_md(dir: &Path, body: &str) {
        fs::create_dir_all(dir).unwrap();
        fs::write(dir.join("SKILL.md"), body).unwrap();
    }

    fn valid_skill_md(name: &str) -> String {
        format!("---\nname: {name}\ndescription: A demo skill\n---\n\n# {name}\n")
    }

    /// A local git repository standing in for a remote — `file:` is an allowed
    /// transport, so acquisition runs for real rather than through a stub.
    fn git_source(root: &Path, skill_path: &str, name: &str) -> String {
        let repo = root.join("origin");
        write_skill_md(&repo.join(skill_path), &valid_skill_md(name));
        for args in [
            vec!["init", "--quiet", "-b", "main"],
            vec!["config", "user.email", "test@example.com"],
            vec!["config", "user.name", "Test"],
            vec!["add", "-A"],
            vec!["commit", "--quiet", "-m", "seed"],
        ] {
            let status = std::process::Command::new("git")
                .args(&args)
                .current_dir(&repo)
                .output()
                .unwrap();
            assert!(status.status.success(), "git {args:?} failed");
        }
        format!("file://{}", repo.display())
    }

    fn status_of(result: &SkillProjectionResult, provider_id: &str) -> SkillTargetStatus {
        result
            .results
            .iter()
            .find(|r| r.provider_id == provider_id)
            .unwrap_or_else(|| panic!("no outcome for {provider_id}"))
            .status
            .clone()
    }

    #[test]
    fn installs_into_universal_and_links_providers() {
        let root = temp_root("install");
        let home = root.join("home");
        fs::create_dir_all(&home).unwrap();
        let source = git_source(&root, "skills/demo", "demo");

        let result = install_skill(
            &source,
            "demo",
            &["codex".into(), "claude-code".into()],
            None,
            &root.join("cache"),
            &scan_ctx(&home),
        )
        .unwrap();

        assert!(!result.cache_hit);
        assert_eq!(status_of(&result, "universal"), SkillTargetStatus::Written);
        assert_eq!(status_of(&result, "codex"), SkillTargetStatus::Written);
        let canonical = home.join(".agents/skills/demo");
        assert!(canonical.join("SKILL.md").is_file());
        assert_eq!(
            fs::read_link(home.join(".codex/skills/demo")).unwrap(),
            canonical
        );
    }

    /// The acceptance criterion: a second install of the same source answers
    /// from the cache. Deleting the origin first is what proves "no network
    /// request" — an install that touched it could not succeed.
    #[test]
    fn a_cached_install_needs_no_remote_and_is_fast() {
        let root = temp_root("cache-hit");
        let home = root.join("home");
        fs::create_dir_all(&home).unwrap();
        let source = git_source(&root, "demo", "demo");
        let cache = root.join("cache");
        let ctx = scan_ctx(&home);
        let providers: Vec<String> = load_registry()
            .unwrap()
            .providers
            .iter()
            .map(|p| p.id.clone())
            .collect();

        install_skill(&source, "demo", &providers, None, &cache, &ctx).unwrap();
        fs::remove_dir_all(root.join("origin")).unwrap();

        let started = std::time::Instant::now();
        let second = install_skill(&source, "demo", &providers, None, &cache, &ctx).unwrap();
        let elapsed = started.elapsed();

        assert!(second.cache_hit);
        assert_eq!(status_of(&second, "universal"), SkillTargetStatus::Written);
        assert!(elapsed.as_millis() < 500, "cached install took {elapsed:?}");
    }

    /// The headline number: `npx skills remove` cost ~1.4 s per provider,
    /// sequentially. Every provider in the registry, in one call, under 2 s.
    #[test]
    fn uninstalling_from_every_provider_is_under_two_seconds() {
        let root = temp_root("uninstall-all");
        let home = root.join("home");
        let ctx = scan_ctx(&home);
        let mut ids: Vec<String> = load_registry()
            .unwrap()
            .providers
            .iter()
            .map(|p| p.id.clone())
            .collect();
        ids.push(UNIVERSAL_PROVIDER_ID.into());

        let targets = provider_targets(&ids, None, &ctx).unwrap();
        assert!(targets.resolved.len() > 20, "expected a wide fan-out");
        for target in &targets.resolved {
            write_skill_md(&target.root.join("demo"), &valid_skill_md("demo"));
        }

        let started = std::time::Instant::now();
        let result = uninstall_skill("demo", &ids, &ctx).unwrap();
        let elapsed = started.elapsed();

        assert!(elapsed.as_millis() < 2000, "uninstall took {elapsed:?}");
        assert!(result
            .results
            .iter()
            .all(|r| r.status != SkillTargetStatus::Failed));
        for target in &targets.resolved {
            assert!(!target.root.join("demo").exists());
        }
    }

    /// Six providers declare `~/.agents/skills` outright. Linking one at the
    /// Universal copy would delete that copy and replace it with a self-link.
    #[test]
    fn installing_into_a_provider_that_shares_the_universal_root_keeps_the_bundle() {
        let root = temp_root("shared-root");
        let home = root.join("home");
        fs::create_dir_all(&home).unwrap();
        let source = git_source(&root, "demo", "demo");

        let result = install_skill(
            &source,
            "demo",
            &["zed".into(), "warp".into()],
            None,
            &root.join("cache"),
            &scan_ctx(&home),
        )
        .unwrap();

        assert_eq!(status_of(&result, "zed"), SkillTargetStatus::AlreadyPresent);
        let canonical = home.join(".agents/skills/demo");
        assert!(canonical.join("SKILL.md").is_file());
        assert!(!fs::symlink_metadata(&canonical)
            .unwrap()
            .file_type()
            .is_symlink());
    }

    #[test]
    fn rejects_a_bundle_with_conflict_markers() {
        let root = temp_root("conflicted");
        let bundle = root.join("demo");
        write_skill_md(
            &bundle,
            "---\nname: demo\ndescription: d\n---\n\n<<<<<<< HEAD\nmine\n=======\ntheirs\n>>>>>>> other\n",
        );

        let err = validate_bundle(&bundle, "demo").unwrap_err();
        assert!(err.contains("conflict markers"));
    }

    #[test]
    fn rejects_a_bundle_without_frontmatter() {
        let root = temp_root("no-frontmatter");
        let bundle = root.join("demo");
        write_skill_md(&bundle, "# demo\n");

        let err = validate_bundle(&bundle, "demo").unwrap_err();
        assert!(err.contains("frontmatter"));
    }

    #[test]
    fn finds_a_nested_skill_folder_and_prefers_the_shallowest() {
        let root = temp_root("locate");
        write_skill_md(&root.join("packs/demo"), &valid_skill_md("demo"));
        write_skill_md(&root.join("packs/extra/demo"), &valid_skill_md("demo"));

        assert_eq!(
            locate_skill_dir(&root, "demo").unwrap(),
            root.join("packs/demo")
        );
    }

    #[test]
    fn ignores_dot_directories_when_locating() {
        let root = temp_root("locate-hidden");
        write_skill_md(&root.join(".git/demo"), &valid_skill_md("demo"));

        assert!(locate_skill_dir(&root, "demo").is_none());
    }

    #[test]
    fn uninstall_reports_every_target_independently() {
        let root = temp_root("uninstall");
        let home = root.join("home");
        let universal = home.join(".agents/skills/demo");
        write_skill_md(&universal, &valid_skill_md("demo"));
        let ctx = scan_ctx(&home);

        let result = uninstall_skill(
            "demo",
            &[
                "codex".into(),
                "not-a-provider".into(),
                UNIVERSAL_PROVIDER_ID.into(),
            ],
            &ctx,
        )
        .unwrap();

        assert_eq!(status_of(&result, "codex"), SkillTargetStatus::Absent);
        assert_eq!(
            status_of(&result, "not-a-provider"),
            SkillTargetStatus::Failed
        );
        assert_eq!(
            status_of(&result, UNIVERSAL_PROVIDER_ID),
            SkillTargetStatus::Removed
        );
        assert!(!universal.exists());
    }

    /// The bug this replaces: the old loop threw on the first non-zero exit, so
    /// one stale provider left every later provider installed and skipped the
    /// Universal cleanup entirely.
    #[test]
    fn an_unresolvable_provider_does_not_skip_the_universal_cleanup() {
        let root = temp_root("uninstall-independent");
        let home = root.join("home");
        write_skill_md(&home.join(".agents/skills/demo"), &valid_skill_md("demo"));
        write_skill_md(&home.join(".codex/skills/demo"), &valid_skill_md("demo"));

        let result = uninstall_skill(
            "demo",
            &[
                "not-a-provider".into(),
                "codex".into(),
                UNIVERSAL_PROVIDER_ID.into(),
            ],
            &scan_ctx(&home),
        )
        .unwrap();

        assert_eq!(status_of(&result, "codex"), SkillTargetStatus::Removed);
        assert_eq!(
            status_of(&result, UNIVERSAL_PROVIDER_ID),
            SkillTargetStatus::Removed
        );
        assert!(!home.join(".agents/skills/demo").exists());
    }

    #[test]
    fn rejects_a_traversing_skill_name() {
        let root = temp_root("traversal");
        let err = uninstall_skill("../outside", &[], &scan_ctx(&root)).unwrap_err();
        assert!(err.contains("single path segment"));
    }
}
