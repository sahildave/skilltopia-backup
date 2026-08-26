//! Copy every skill one provider owns into other providers, in one pass.
//!
//! The single-skill fan-out in `copy` answers "where else should this skill
//! live"; this answers "make that agent look like this one". The difference
//! that matters is the source: `copy` picks a bundle by name under a global
//! preference order that starts at Universal, which would silently source half
//! of Claude Code's skills from `~/.agents/skills`. Here the source provider is
//! named, so each skill is resolved directly under that provider's own skills
//! directory and only a real (non-symlinked) directory is accepted — the same
//! set the toolbar's "Provider" view shows.
//!
//! A name already present at the destination is left alone and reported as
//! skipped; the projection layer already refuses to replace a foreign real
//! directory, so this module only has to keep that outcome distinct from a
//! successful write instead of folding it into "copied".

use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::BTreeSet;
use std::path::PathBuf;

use super::plugin_guard::PluginGuard;
use super::projection::{
    project_skill, ForeignDirPolicy, ProjectionMode, ProjectionStatus, ProjectionTarget,
};
use super::scan::{
    classify_skill_entry, resolve_provider_skills_dir, validate_skill_dir_name, ScanContext,
};
use super::types::UNIVERSAL_PROVIDER_ID;

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum BulkCopyStatus {
    Copied,
    /// Already there: the destination holds this name, or resolves onto the
    /// source itself. Nothing was touched.
    Skipped,
    /// The destination is inside the read-only Claude plugin cache.
    Refused,
    Failed,
}

/// One skill that did not copy, named so the summary can say which.
#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BulkCopyIssue {
    pub skill_name: String,
    pub status: BulkCopyStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

/// One tick of a bulk copy, emitted after a skill has been handled for every
/// target. `completed` counts skills finished, not per-target writes, so it
/// advances once per name regardless of how many destinations are selected.
#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BulkCopyProgress {
    pub completed: u32,
    pub total: u32,
    pub skill_name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct BulkCopyTargetResult {
    pub provider_id: String,
    pub copied: u32,
    pub skipped: u32,
    pub refused: u32,
    pub failed: u32,
    /// Failures only. Skipped and refused are counted, not enumerated: a
    /// refused destination refuses every skill, and listing 178 of them says
    /// nothing the count does not.
    pub issues: Vec<BulkCopyIssue>,
}

impl BulkCopyTargetResult {
    fn new(provider_id: &str) -> Self {
        Self {
            provider_id: provider_id.to_string(),
            copied: 0,
            skipped: 0,
            refused: 0,
            failed: 0,
            issues: Vec::new(),
        }
    }

    fn record(&mut self, skill_name: &str, status: BulkCopyStatus, message: Option<String>) {
        match status {
            BulkCopyStatus::Copied => self.copied += 1,
            BulkCopyStatus::Skipped => self.skipped += 1,
            BulkCopyStatus::Refused => self.refused += 1,
            BulkCopyStatus::Failed => {
                self.failed += 1;
                self.issues.push(BulkCopyIssue {
                    skill_name: skill_name.to_string(),
                    status: BulkCopyStatus::Failed,
                    message,
                });
            }
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CopyProviderSkillsResult {
    pub targets: Vec<BulkCopyTargetResult>,
}

/// Copy each named skill from `source_provider_id` into every target provider.
///
/// Hard errors are reserved for a source provider that does not resolve and for
/// an empty skill or target list. Everything else is per-skill, per-target and
/// non-fatal, so one bad bundle never costs the rest of the batch.
pub fn copy_provider_skills(
    source_provider_id: &str,
    skill_names: &[String],
    target_provider_ids: &[String],
    ctx: &ScanContext,
    on_progress: &dyn Fn(BulkCopyProgress),
) -> Result<CopyProviderSkillsResult, String> {
    if skill_names.is_empty() {
        return Err("At least one skill name is required".into());
    }
    if target_provider_ids.is_empty() {
        return Err("At least one provider id is required".into());
    }

    let source_dir = resolve_provider_skills_dir(source_provider_id, ctx)?
        .ok_or_else(|| format!("Unknown or unresolvable provider '{source_provider_id}'"))?;

    let guard = PluginGuard::for_context(ctx);
    let names = dedupe(skill_names);
    let mut targets: Vec<(BulkCopyTargetResult, Option<PathBuf>)> = Vec::new();

    for provider_id in dedupe(target_provider_ids) {
        let mut result = BulkCopyTargetResult::new(&provider_id);
        let root = match target_root(&provider_id, ctx) {
            Ok(root) => Some(root),
            Err(message) => {
                result.failed = names.len() as u32;
                result.issues = names
                    .iter()
                    .map(|skill_name| BulkCopyIssue {
                        skill_name: skill_name.clone(),
                        status: BulkCopyStatus::Failed,
                        message: Some(message.clone()),
                    })
                    .collect();
                None
            }
        };
        targets.push((result, root));
    }

    let total = names.len() as u32;

    for (index, skill_name) in names.iter().enumerate() {
        match resolve_owned_source(source_provider_id, &source_dir, skill_name) {
            Err(message) => {
                for (result, root) in targets.iter_mut() {
                    if root.is_some() {
                        result.record(skill_name, BulkCopyStatus::Failed, Some(message.clone()));
                    }
                }
            }
            Ok(source) => {
                for (result, root) in targets.iter_mut() {
                    let Some(root) = root else { continue };
                    let outcome = project_skill(
                        &source,
                        skill_name,
                        &[ProjectionTarget {
                            id: result.provider_id.clone(),
                            root: root.clone(),
                        }],
                        ProjectionMode::Symlink,
                        ForeignDirPolicy::Refuse,
                        None,
                        &guard,
                    )
                    .remove(0);

                    let status = match outcome.status {
                        ProjectionStatus::Written => BulkCopyStatus::Copied,
                        // Already there, either by name or through an aliased root.
                        ProjectionStatus::AlreadyPresent | ProjectionStatus::Conflict => {
                            BulkCopyStatus::Skipped
                        }
                        ProjectionStatus::Refused => BulkCopyStatus::Refused,
                        _ => BulkCopyStatus::Failed,
                    };
                    result.record(skill_name, status, outcome.message);
                }
            }
        }

        // A skill that could not be sourced still consumed its share of the
        // batch, so it ticks too — otherwise the bar stalls on a bad bundle.
        on_progress(BulkCopyProgress {
            completed: index as u32 + 1,
            total,
            skill_name: skill_name.clone(),
        });
    }

    Ok(CopyProviderSkillsResult {
        targets: targets.into_iter().map(|(result, _)| result).collect(),
    })
}

fn target_root(provider_id: &str, ctx: &ScanContext) -> Result<PathBuf, String> {
    if provider_id == UNIVERSAL_PROVIDER_ID {
        return Err("Universal is not a valid copy destination".into());
    }
    resolve_provider_skills_dir(provider_id, ctx)?
        .ok_or_else(|| format!("Unknown or unresolvable provider '{provider_id}'"))
}

/// The source bundle must be a real directory the source provider owns.
/// A symlink there is a projection of someone else's content, and copying it on
/// would attribute another provider's (or Universal's) skill to this one.
fn resolve_owned_source(
    source_provider_id: &str,
    source_dir: &std::path::Path,
    skill_name: &str,
) -> Result<PathBuf, String> {
    validate_skill_dir_name(skill_name)?;
    let entry_path = source_dir.join(skill_name);
    let Some(entry) = classify_skill_entry(&entry_path) else {
        return Err(format!(
            "Skill '{skill_name}' is not a directory in {source_provider_id}'s skills folder"
        ));
    };
    if entry.original_path.is_some() {
        return Err(format!(
            "Skill '{skill_name}' is a symlink in {source_provider_id}'s skills folder, not a skill it owns"
        ));
    }
    if !entry.content_root.join("SKILL.md").is_file() {
        return Err(format!("Skill '{skill_name}' has no SKILL.md"));
    }
    Ok(entry.content_root)
}

fn dedupe(values: &[String]) -> Vec<String> {
    let mut seen = BTreeSet::new();
    values
        .iter()
        .filter(|value| seen.insert((*value).clone()))
        .cloned()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::super::paths::ProbeContext;
    use super::*;
    use std::collections::HashMap;
    use std::fs;
    use std::path::Path;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn write_skill(dir: &Path, folder: &str, description: &str) {
        let skill_dir = dir.join(folder);
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(
            skill_dir.join("SKILL.md"),
            format!("---\nname: {folder}\ndescription: {description}\n---\n\n# {folder}\n"),
        )
        .unwrap();
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

    fn temp_home(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "skilltopia-bulk-copy-{label}-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn names(values: &[&str]) -> Vec<String> {
        values.iter().map(|v| (*v).to_string()).collect()
    }

    #[test]
    fn rejects_empty_skill_list() {
        let home = temp_home("empty-skills");
        let err = copy_provider_skills(
            "claude-code",
            &[],
            &names(&["codex"]),
            &scan_ctx(&home),
            &|_| {},
        )
        .unwrap_err();
        assert!(err.contains("At least one skill name"));
    }

    #[test]
    fn rejects_empty_target_list() {
        let home = temp_home("empty-targets");
        let err = copy_provider_skills(
            "claude-code",
            &names(&["a"]),
            &[],
            &scan_ctx(&home),
            &|_| {},
        )
        .unwrap_err();
        assert!(err.contains("At least one provider id"));
    }

    #[test]
    fn rejects_unresolvable_source_provider() {
        let home = temp_home("bad-source");
        let err = copy_provider_skills(
            "not-a-provider",
            &names(&["a"]),
            &names(&["codex"]),
            &scan_ctx(&home),
            &|_| {},
        )
        .unwrap_err();
        assert!(err.contains("Unknown or unresolvable provider"));
    }

    #[test]
    fn skips_a_name_the_destination_already_has() {
        let home = temp_home("skip-existing");
        let claude = home.join(".claude/skills");
        write_skill(&claude, "code-review", "Source copy");
        write_skill(&claude, "find-skills", "Also source");
        fs::create_dir_all(home.join(".claude")).unwrap();

        let codex = home.join(".codex/skills");
        write_skill(&codex, "code-review", "Destination's own");
        let before = fs::read_to_string(codex.join("code-review/SKILL.md")).unwrap();

        let result = copy_provider_skills(
            "claude-code",
            &names(&["code-review", "find-skills"]),
            &names(&["codex"]),
            &scan_ctx(&home),
            &|_| {},
        )
        .unwrap();

        let target = &result.targets[0];
        assert_eq!(target.copied, 1);
        assert_eq!(target.skipped, 1);
        assert_eq!(target.failed, 0);
        // The existing skill is untouched, not replaced by a link.
        assert_eq!(
            fs::read_to_string(codex.join("code-review/SKILL.md")).unwrap(),
            before
        );
        assert!(codex.join("find-skills").exists());
    }

    #[test]
    fn one_failing_skill_does_not_abort_the_batch() {
        let home = temp_home("partial-failure");
        let claude = home.join(".claude/skills");
        write_skill(&claude, "code-review", "Real");
        fs::create_dir_all(home.join(".claude")).unwrap();

        let result = copy_provider_skills(
            "claude-code",
            &names(&["missing-skill", "code-review"]),
            &names(&["codex"]),
            &scan_ctx(&home),
            &|_| {},
        )
        .unwrap();

        let target = &result.targets[0];
        assert_eq!(target.copied, 1);
        assert_eq!(target.failed, 1);
        assert_eq!(target.issues.len(), 1);
        assert_eq!(target.issues[0].skill_name, "missing-skill");
        assert!(home.join(".codex/skills/code-review").exists());
    }

    /// The whole point of a separate source resolver: a Universal copy of the
    /// same name must not win over the provider the user selected.
    #[test]
    fn takes_source_from_the_selected_provider_not_universal() {
        let home = temp_home("source-provider");
        let universal = home.join(".agents/skills");
        write_skill(&universal, "code-review", "Universal copy");
        let claude = home.join(".claude/skills");
        write_skill(&claude, "code-review", "Claude Code copy");
        fs::create_dir_all(home.join(".claude")).unwrap();

        let result = copy_provider_skills(
            "claude-code",
            &names(&["code-review"]),
            &names(&["codex"]),
            &scan_ctx(&home),
            &|_| {},
        )
        .unwrap();

        assert_eq!(result.targets[0].copied, 1);
        assert_eq!(
            fs::read_link(home.join(".codex/skills/code-review")).unwrap(),
            claude.join("code-review")
        );
    }

    /// A symlinked entry in the source directory is another provider's content
    /// projected in, not a skill this provider owns.
    #[test]
    #[cfg(unix)]
    fn refuses_a_symlinked_entry_as_a_source() {
        use std::os::unix::fs::symlink;

        let home = temp_home("symlinked-source");
        let universal = home.join(".agents/skills");
        write_skill(&universal, "code-review", "Universal copy");
        let claude = home.join(".claude/skills");
        fs::create_dir_all(&claude).unwrap();
        fs::create_dir_all(home.join(".claude")).unwrap();
        symlink(universal.join("code-review"), claude.join("code-review")).unwrap();

        let result = copy_provider_skills(
            "claude-code",
            &names(&["code-review"]),
            &names(&["codex"]),
            &scan_ctx(&home),
            &|_| {},
        )
        .unwrap();

        assert_eq!(result.targets[0].copied, 0);
        assert_eq!(result.targets[0].failed, 1);
        assert!(result.targets[0].issues[0]
            .message
            .as_deref()
            .unwrap()
            .contains("symlink"));
    }

    #[test]
    #[cfg(unix)]
    fn refuses_a_destination_inside_the_plugin_cache() {
        use std::os::unix::fs::symlink;

        let home = temp_home("plugin-cache");
        let claude = home.join(".claude/skills");
        write_skill(&claude, "code-review", "Real");
        fs::create_dir_all(home.join(".claude")).unwrap();

        // Point Codex's skills root at the read-only plugin cache.
        let plugin_cache = home.join(".claude/plugins/cache/marketplace/demo/skills");
        fs::create_dir_all(&plugin_cache).unwrap();
        fs::create_dir_all(home.join(".codex")).unwrap();
        symlink(&plugin_cache, home.join(".codex/skills")).unwrap();

        let result = copy_provider_skills(
            "claude-code",
            &names(&["code-review"]),
            &names(&["codex"]),
            &scan_ctx(&home),
            &|_| {},
        )
        .unwrap();

        let target = &result.targets[0];
        assert_eq!(target.refused, 1);
        assert_eq!(target.copied, 0);
        assert!(!plugin_cache.join("code-review").exists());
    }

    #[test]
    fn deduplicates_repeated_skill_names_and_targets() {
        let home = temp_home("dedupe");
        let claude = home.join(".claude/skills");
        write_skill(&claude, "code-review", "Real");
        fs::create_dir_all(home.join(".claude")).unwrap();

        let result = copy_provider_skills(
            "claude-code",
            &names(&["code-review", "code-review"]),
            &names(&["codex", "codex"]),
            &scan_ctx(&home),
            &|_| {},
        )
        .unwrap();

        assert_eq!(result.targets.len(), 1);
        assert_eq!(result.targets[0].copied, 1);
        assert_eq!(result.targets[0].skipped, 0);
    }

    /// One tick per skill, in order, counting up to the deduped total — and
    /// the outcome counts are the same as a run with no sink at all.
    #[test]
    fn emits_one_progress_tick_per_skill() {
        let home = temp_home("progress-ticks");
        let claude = home.join(".claude/skills");
        write_skill(&claude, "code-review", "Real");
        write_skill(&claude, "tdd", "Real");
        fs::create_dir_all(home.join(".claude")).unwrap();

        let ticks = std::cell::RefCell::new(Vec::new());
        let result = copy_provider_skills(
            "claude-code",
            // A missing skill and a duplicate: neither may stall or double-tick.
            &names(&["code-review", "missing-skill", "tdd", "tdd"]),
            &names(&["codex"]),
            &scan_ctx(&home),
            &|progress| ticks.borrow_mut().push(progress),
        )
        .unwrap();

        let ticks = ticks.into_inner();
        assert_eq!(
            ticks
                .iter()
                .map(|t| (t.completed, t.total, t.skill_name.as_str()))
                .collect::<Vec<_>>(),
            vec![
                (1, 3, "code-review"),
                (2, 3, "missing-skill"),
                (3, 3, "tdd"),
            ]
        );
        assert_eq!(result.targets[0].copied, 2);
        assert_eq!(result.targets[0].failed, 1);
    }

    #[test]
    fn universal_is_not_a_valid_destination() {
        let home = temp_home("universal-target");
        let claude = home.join(".claude/skills");
        write_skill(&claude, "code-review", "Real");
        fs::create_dir_all(home.join(".claude")).unwrap();

        let result = copy_provider_skills(
            "claude-code",
            &names(&["code-review"]),
            &names(&["universal", "codex"]),
            &scan_ctx(&home),
            &|_| {},
        )
        .unwrap();

        let universal_target = result
            .targets
            .iter()
            .find(|t| t.provider_id == "universal")
            .unwrap();
        assert_eq!(universal_target.failed, 1);
        assert!(universal_target.issues[0]
            .message
            .as_deref()
            .unwrap()
            .contains("not a valid copy destination"));
        // The valid target still ran.
        let codex_target = result
            .targets
            .iter()
            .find(|t| t.provider_id == "codex")
            .unwrap();
        assert_eq!(codex_target.copied, 1);
    }
}
