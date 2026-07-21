//! Copy an installed skill into provider skill folders via directory symlinks.

use crate::utils::platform::normalize_path_for_serialization;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};

use super::paths::{load_registry, resolve_global_skills_dir, universal_skills_dir};
use super::scan::{classify_skill_entry, validate_skill_dir_name, ScanContext};
use super::types::UNIVERSAL_PROVIDER_ID;

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CopyProviderStatus {
    Copied,
    Conflict,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CopyProviderResult {
    pub provider_id: String,
    pub status: CopyProviderStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CopySkillToProvidersResult {
    pub results: Vec<CopyProviderResult>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum SourceKind {
    /// Prefer any Universal entry (real directory or resolved symlink).
    Universal,
    RealDir,
    SymlinkTarget,
}

#[derive(Debug, Clone)]
struct SourceCandidate {
    kind: SourceKind,
    content_root: PathBuf,
}

/// Copy one installed skill into each selected provider as a directory symlink.
///
/// Hard errors cover invalid identifiers and missing/ambiguous sources.
/// Per-provider outcomes stay independent so partial success is preserved.
pub fn copy_skill_to_providers(
    uninstall_name: &str,
    provider_ids: &[String],
    ctx: &ScanContext,
) -> Result<CopySkillToProvidersResult, String> {
    validate_skill_dir_name(uninstall_name)?;

    if provider_ids.is_empty() {
        return Err("At least one provider id is required".into());
    }

    let source = resolve_copy_source(uninstall_name, ctx)?;
    let mut results = Vec::with_capacity(provider_ids.len());
    let mut seen = BTreeSet::new();

    for provider_id in provider_ids {
        if !seen.insert(provider_id.clone()) {
            continue;
        }
        results.push(copy_to_one_provider(
            uninstall_name,
            provider_id,
            &source,
            ctx,
        ));
    }

    Ok(CopySkillToProvidersResult { results })
}

fn resolve_copy_source(uninstall_name: &str, ctx: &ScanContext) -> Result<PathBuf, String> {
    let candidates = collect_source_candidates(uninstall_name, ctx)?;
    if candidates.is_empty() {
        return Err(format!(
            "Skill '{uninstall_name}' was not found in Universal or any provider skills directory"
        ));
    }

    if let Some(path) = first_unique_root(&candidates, SourceKind::Universal)? {
        return Ok(path);
    }
    if let Some(path) = first_unique_root(&candidates, SourceKind::RealDir)? {
        return Ok(path);
    }
    first_unique_root(&candidates, SourceKind::SymlinkTarget)?.ok_or_else(|| {
        format!(
            "Skill '{uninstall_name}' was not found in Universal or any provider skills directory"
        )
    })
}

fn first_unique_root(
    candidates: &[SourceCandidate],
    kind: SourceKind,
) -> Result<Option<PathBuf>, String> {
    let matching: Vec<&SourceCandidate> = candidates.iter().filter(|c| c.kind == kind).collect();
    if matching.is_empty() {
        return Ok(None);
    }

    let mut roots = BTreeSet::new();
    for candidate in &matching {
        roots.insert(normalize_comparable(&candidate.content_root));
    }
    if roots.len() > 1 {
        return Err(format!(
            "Skill source is ambiguous: found multiple distinct {} paths",
            match kind {
                SourceKind::Universal => "Universal",
                SourceKind::RealDir => "real directory",
                SourceKind::SymlinkTarget => "symlink target",
            }
        ));
    }

    Ok(Some(matching[0].content_root.clone()))
}

fn collect_source_candidates(
    uninstall_name: &str,
    ctx: &ScanContext,
) -> Result<Vec<SourceCandidate>, String> {
    let mut candidates = Vec::new();
    let universal_dir = universal_skills_dir(&ctx.probe);
    push_candidate(&mut candidates, &universal_dir.join(uninstall_name), true);

    let registry = load_registry()?;
    for provider in &registry.providers {
        let Some(skills_dir) = resolve_global_skills_dir(&provider.global_skills_dir, &ctx.probe)
        else {
            continue;
        };
        if skills_dir == universal_dir {
            continue;
        }
        push_candidate(&mut candidates, &skills_dir.join(uninstall_name), false);
    }

    Ok(candidates)
}

fn push_candidate(candidates: &mut Vec<SourceCandidate>, entry_path: &Path, is_universal: bool) {
    let Some(entry) = classify_skill_entry(entry_path) else {
        return;
    };
    if !entry.content_root.join("SKILL.md").is_file() {
        return;
    }

    let kind = if is_universal {
        SourceKind::Universal
    } else if entry.original_path.is_none() {
        SourceKind::RealDir
    } else {
        SourceKind::SymlinkTarget
    };

    candidates.push(SourceCandidate {
        kind,
        content_root: entry.content_root,
    });
}

fn copy_to_one_provider(
    uninstall_name: &str,
    provider_id: &str,
    source: &Path,
    ctx: &ScanContext,
) -> CopyProviderResult {
    if provider_id == UNIVERSAL_PROVIDER_ID {
        return CopyProviderResult {
            provider_id: provider_id.to_string(),
            status: CopyProviderStatus::Failed,
            message: Some("Universal is not a valid copy destination".into()),
        };
    }

    let skills_dir = match super::scan::resolve_provider_skills_dir(provider_id, ctx) {
        Ok(Some(dir)) => dir,
        Ok(None) => {
            return CopyProviderResult {
                provider_id: provider_id.to_string(),
                status: CopyProviderStatus::Failed,
                message: Some(format!("Unknown or unresolvable provider '{provider_id}'")),
            };
        }
        Err(message) => {
            return CopyProviderResult {
                provider_id: provider_id.to_string(),
                status: CopyProviderStatus::Failed,
                message: Some(message),
            };
        }
    };

    if let Err(message) = fs::create_dir_all(&skills_dir) {
        return CopyProviderResult {
            provider_id: provider_id.to_string(),
            status: CopyProviderStatus::Failed,
            message: Some(format!(
                "Failed to create skills directory '{}': {message}",
                normalize_path_for_serialization(&skills_dir)
            )),
        };
    }

    let target = skills_dir.join(uninstall_name);
    if fs::symlink_metadata(&target).is_ok() {
        return CopyProviderResult {
            provider_id: provider_id.to_string(),
            status: CopyProviderStatus::Conflict,
            message: Some(format!(
                "Path already exists: {}",
                normalize_path_for_serialization(&target)
            )),
        };
    }

    match create_dir_symlink(source, &target) {
        Ok(()) => CopyProviderResult {
            provider_id: provider_id.to_string(),
            status: CopyProviderStatus::Copied,
            message: None,
        },
        Err(message) => CopyProviderResult {
            provider_id: provider_id.to_string(),
            status: CopyProviderStatus::Failed,
            message: Some(message),
        },
    }
}

fn create_dir_symlink(source: &Path, target: &Path) -> Result<(), String> {
    let absolute_source = if source.is_absolute() {
        source.to_path_buf()
    } else {
        std::env::current_dir()
            .map_err(|e| format!("Failed to resolve current directory: {e}"))?
            .join(source)
    };

    #[cfg(unix)]
    {
        std::os::unix::fs::symlink(&absolute_source, target).map_err(|e| {
            format!(
                "Failed to create symlink '{}' → '{}': {e}",
                normalize_path_for_serialization(target),
                normalize_path_for_serialization(&absolute_source)
            )
        })
    }

    #[cfg(windows)]
    {
        std::os::windows::fs::symlink_dir(&absolute_source, target).map_err(|e| {
            format!(
                "Failed to create symlink '{}' → '{}': {e}",
                normalize_path_for_serialization(target),
                normalize_path_for_serialization(&absolute_source)
            )
        })
    }

    #[cfg(not(any(unix, windows)))]
    {
        let _ = (absolute_source, target);
        Err("Directory symlinks are not supported on this platform".into())
    }
}

fn normalize_comparable(path: &Path) -> String {
    fs::canonicalize(path)
        .map(|p| normalize_path_for_serialization(&p))
        .unwrap_or_else(|_| normalize_path_for_serialization(path))
}

#[cfg(test)]
mod tests {
    use super::super::paths::ProbeContext;
    use super::*;
    use std::collections::HashMap;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn write_skill(dir: &Path, folder: &str, name: &str, description: &str) {
        let skill_dir = dir.join(folder);
        fs::create_dir_all(&skill_dir).unwrap();
        fs::write(
            skill_dir.join("SKILL.md"),
            format!("---\nname: {name}\ndescription: {description}\n---\n\n# {name}\n"),
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
            "skills-explorer-copy-{label}-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn rejects_path_traversal_uninstall_name() {
        let home = temp_home("traversal");
        let err = copy_skill_to_providers("../outside", &["claude-code".into()], &scan_ctx(&home))
            .unwrap_err();
        assert!(err.contains("single path segment"));
    }

    #[test]
    fn rejects_empty_provider_list() {
        let home = temp_home("empty-providers");
        let err = copy_skill_to_providers("find-skills", &[], &scan_ctx(&home)).unwrap_err();
        assert!(err.contains("At least one provider"));
    }

    #[test]
    fn rejects_missing_source() {
        let home = temp_home("missing-source");
        let err =
            copy_skill_to_providers("missing-skill", &["claude-code".into()], &scan_ctx(&home))
                .unwrap_err();
        assert!(err.contains("was not found"));
    }

    #[test]
    fn prefers_universal_real_directory_as_source() {
        let home = temp_home("prefer-universal");
        let universal = home.join(".agents/skills");
        let claude_skills = home.join(".claude/skills");
        write_skill(&universal, "find-skills", "find-skills", "Universal copy");
        write_skill(
            &claude_skills,
            "find-skills",
            "find-skills",
            "Provider copy",
        );
        fs::create_dir_all(home.join(".claude")).unwrap();

        let codex_skills = home.join(".codex/skills");
        let result =
            copy_skill_to_providers("find-skills", &["codex".into()], &scan_ctx(&home)).unwrap();

        assert_eq!(result.results.len(), 1);
        assert_eq!(result.results[0].status, CopyProviderStatus::Copied);
        assert_eq!(
            fs::read_link(codex_skills.join("find-skills")).unwrap(),
            universal.join("find-skills")
        );
    }

    #[test]
    #[cfg(unix)]
    fn prefers_universal_symlink_target_over_provider_real_directory() {
        use std::os::unix::fs::symlink;

        let home = temp_home("prefer-universal-symlink");
        let real = home.join("universal-real");
        write_skill(&home, "universal-real", "find-skills", "Universal via link");
        let universal = home.join(".agents/skills");
        fs::create_dir_all(&universal).unwrap();
        symlink(&real, universal.join("find-skills")).unwrap();

        let claude_skills = home.join(".claude/skills");
        write_skill(
            &claude_skills,
            "find-skills",
            "find-skills",
            "Provider copy",
        );
        fs::create_dir_all(home.join(".claude")).unwrap();

        let result =
            copy_skill_to_providers("find-skills", &["codex".into()], &scan_ctx(&home)).unwrap();

        assert_eq!(result.results[0].status, CopyProviderStatus::Copied);
        assert_eq!(
            fs::read_link(home.join(".codex/skills/find-skills")).unwrap(),
            real
        );
    }

    #[test]
    fn uses_real_provider_directory_when_universal_missing() {
        let home = temp_home("real-provider");
        let claude_skills = home.join(".claude/skills");
        write_skill(&claude_skills, "code-review", "code-review", "Review code");
        fs::create_dir_all(home.join(".claude")).unwrap();

        let result =
            copy_skill_to_providers("code-review", &["codex".into()], &scan_ctx(&home)).unwrap();

        assert_eq!(result.results[0].status, CopyProviderStatus::Copied);
        assert_eq!(
            fs::read_link(home.join(".codex/skills/code-review")).unwrap(),
            claude_skills.join("code-review")
        );
    }

    #[test]
    #[cfg(unix)]
    fn uses_resolved_symlink_target_when_no_real_directory() {
        use std::os::unix::fs::symlink;

        let home = temp_home("symlink-source");
        let real = home.join("real-skill");
        write_skill(&home, "real-skill", "linked-skill", "Via symlink");
        let claude_skills = home.join(".claude/skills");
        fs::create_dir_all(&claude_skills).unwrap();
        fs::create_dir_all(home.join(".claude")).unwrap();
        symlink(&real, claude_skills.join("linked-skill")).unwrap();

        let result =
            copy_skill_to_providers("linked-skill", &["codex".into()], &scan_ctx(&home)).unwrap();

        assert_eq!(result.results[0].status, CopyProviderStatus::Copied);
        assert_eq!(
            fs::read_link(home.join(".codex/skills/linked-skill")).unwrap(),
            real
        );
    }

    #[test]
    fn creates_missing_provider_skills_folder() {
        let home = temp_home("create-folder");
        let universal = home.join(".agents/skills");
        write_skill(&universal, "find-skills", "find-skills", "Find skills");

        let codex_skills = home.join(".codex/skills");
        assert!(!codex_skills.exists());

        let result =
            copy_skill_to_providers("find-skills", &["codex".into()], &scan_ctx(&home)).unwrap();

        assert_eq!(result.results[0].status, CopyProviderStatus::Copied);
        assert!(codex_skills.is_dir());
        assert!(codex_skills.join("find-skills").exists());
    }

    #[test]
    fn reports_conflict_without_overwriting() {
        let home = temp_home("conflict");
        let universal = home.join(".agents/skills");
        write_skill(&universal, "find-skills", "find-skills", "Find skills");
        let claude_skills = home.join(".claude/skills");
        write_skill(&claude_skills, "find-skills", "find-skills", "Existing");
        fs::create_dir_all(home.join(".claude")).unwrap();

        let before = fs::read_to_string(claude_skills.join("find-skills/SKILL.md")).unwrap();
        let result =
            copy_skill_to_providers("find-skills", &["claude-code".into()], &scan_ctx(&home))
                .unwrap();

        assert_eq!(result.results[0].status, CopyProviderStatus::Conflict);
        assert_eq!(
            fs::read_to_string(claude_skills.join("find-skills/SKILL.md")).unwrap(),
            before
        );
    }

    #[test]
    fn preserves_partial_success_across_providers() {
        let home = temp_home("partial");
        let universal = home.join(".agents/skills");
        write_skill(&universal, "find-skills", "find-skills", "Find skills");
        let claude_skills = home.join(".claude/skills");
        write_skill(&claude_skills, "find-skills", "find-skills", "Existing");
        fs::create_dir_all(home.join(".claude")).unwrap();

        let result = copy_skill_to_providers(
            "find-skills",
            &["claude-code".into(), "codex".into(), "universal".into()],
            &scan_ctx(&home),
        )
        .unwrap();

        assert_eq!(result.results.len(), 3);
        assert_eq!(result.results[0].provider_id, "claude-code");
        assert_eq!(result.results[0].status, CopyProviderStatus::Conflict);
        assert_eq!(result.results[1].provider_id, "codex");
        assert_eq!(result.results[1].status, CopyProviderStatus::Copied);
        assert_eq!(result.results[2].provider_id, "universal");
        assert_eq!(result.results[2].status, CopyProviderStatus::Failed);
        assert!(home.join(".codex/skills/find-skills").exists());
    }

    #[test]
    fn rejects_ambiguous_real_directory_sources() {
        let home = temp_home("ambiguous");
        write_skill(
            &home.join(".claude/skills"),
            "find-skills",
            "find-skills",
            "Claude",
        );
        write_skill(
            &home.join(".codex/skills"),
            "find-skills",
            "find-skills",
            "Codex",
        );
        fs::create_dir_all(home.join(".claude")).unwrap();
        fs::create_dir_all(home.join(".codex")).unwrap();

        let err = copy_skill_to_providers("find-skills", &["gemini-cli".into()], &scan_ctx(&home))
            .unwrap_err();
        assert!(err.contains("ambiguous"));
    }

    #[test]
    fn fails_unknown_provider_without_aborting_others() {
        let home = temp_home("unknown-provider");
        let universal = home.join(".agents/skills");
        write_skill(&universal, "find-skills", "find-skills", "Find skills");

        let result = copy_skill_to_providers(
            "find-skills",
            &["not-a-provider".into(), "codex".into()],
            &scan_ctx(&home),
        )
        .unwrap();

        assert_eq!(result.results[0].status, CopyProviderStatus::Failed);
        assert_eq!(result.results[1].status, CopyProviderStatus::Copied);
    }
}
