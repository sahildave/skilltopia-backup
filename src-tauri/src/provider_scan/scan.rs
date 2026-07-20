//! Scan global skill directories and build a normalized snapshot.

use crate::utils::platform::normalize_path_for_serialization;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use super::frontmatter::parse_skill_md;
use super::paths::{
    evaluate_detection, load_registry, resolve_global_skills_dir, universal_skills_dir,
    GlobalSkillsDir, ProbeContext, RegistryFile,
};
use super::types::{
    InstalledScanSnapshot, ProviderRegistrySourceMeta, ScanWarning, ScanWarningCode,
    ScannedProvider, ScannedSkill, ScannedSkillPath, UniversalScanInfo, UNIVERSAL_PROVIDER_ID,
};

#[derive(Debug, Clone)]
pub struct ScanContext {
    pub probe: ProbeContext,
    pub include_internal: bool,
    pub scanned_at: Option<String>,
}

impl ScanContext {
    pub fn from_environment() -> Self {
        let home = dirs_home();
        let cwd = std::env::current_dir().unwrap_or_else(|_| home.clone());
        let platform = registry_platform();
        let mut env = std::collections::HashMap::new();
        for (key, value) in std::env::vars() {
            env.insert(key, value);
        }
        let include_internal = matches!(
            env.get("INSTALL_INTERNAL_SKILLS").map(String::as_str),
            Some("1") | Some("true")
        );
        Self {
            probe: ProbeContext {
                home,
                cwd,
                platform,
                env,
            },
            include_internal,
            scanned_at: None,
        }
    }
}

fn dirs_home() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        if !home.trim().is_empty() {
            return PathBuf::from(home);
        }
    }
    if let Ok(profile) = std::env::var("USERPROFILE") {
        if !profile.trim().is_empty() {
            return PathBuf::from(profile);
        }
    }
    PathBuf::from(".")
}

fn registry_platform() -> String {
    if cfg!(target_os = "macos") {
        "darwin".into()
    } else if cfg!(target_os = "windows") {
        "win32".into()
    } else {
        "linux".into()
    }
}

fn scanned_at_timestamp() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    unix_secs_to_rfc3339(secs)
}

/// RFC 3339 UTC from unix seconds (civil_from_days / Howard Hinnant).
fn unix_secs_to_rfc3339(secs: u64) -> String {
    let z = (secs / 86_400) as i64 + 719_468;
    let era = if z >= 0 { z } else { z - 146_096 } / 146_097;
    let doe = (z - era * 146_097) as u64;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    let hour = (secs / 3600) % 24;
    let min = (secs / 60) % 60;
    let sec = secs % 60;
    format!("{y:04}-{m:02}-{d:02}T{hour:02}:{min:02}:{sec:02}Z")
}

struct SkillDirEntry {
    /// Path as listed in the skills folder (may be a symlink).
    entry_path: PathBuf,
    /// Directory containing `SKILL.md` (follows symlinks).
    content_root: PathBuf,
    /// Normalized resolved target when `entry_path` is a symlink.
    original_path: Option<PathBuf>,
}

fn resolve_symlink_target(link: &Path, target: &Path) -> Option<PathBuf> {
    if target.is_absolute() {
        Some(target.to_path_buf())
    } else {
        link.parent().map(|parent| parent.join(target))
    }
}

/// Accept real directories and directory symlinks in a skills folder.
fn classify_skill_entry(path: &Path) -> Option<SkillDirEntry> {
    match fs::symlink_metadata(path) {
        Ok(meta) if meta.file_type().is_symlink() => {
            let target = fs::read_link(path).ok()?;
            let resolved = resolve_symlink_target(path, &target)?;
            if !fs::metadata(&resolved).ok()?.is_dir() {
                return None;
            }
            Some(SkillDirEntry {
                entry_path: path.to_path_buf(),
                content_root: resolved.clone(),
                original_path: Some(resolved),
            })
        }
        Ok(meta) if meta.is_dir() => Some(SkillDirEntry {
            entry_path: path.to_path_buf(),
            content_root: path.to_path_buf(),
            original_path: None,
        }),
        _ => None,
    }
}

fn is_hidden_dir_name(name: &str) -> bool {
    name.starts_with('.')
}

struct DirScanOutcome {
    skills: Vec<(String, String, SkillDirEntry)>,
    warnings: Vec<ScanWarning>,
}

fn scan_skills_dir(
    dir: &Path,
    include_internal: bool,
    provider_id_for_warnings: Option<&str>,
) -> DirScanOutcome {
    let mut skills = Vec::new();
    let mut warnings = Vec::new();

    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => {
            return DirScanOutcome { skills, warnings };
        }
    };

    for entry in entries.flatten() {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if is_hidden_dir_name(name) {
            continue;
        }

        let Some(entry) = classify_skill_entry(&path) else {
            continue;
        };

        let skill_md = entry.content_root.join("SKILL.md");
        let Ok(raw) = fs::read_to_string(&skill_md) else {
            warnings.push(ScanWarning {
                code: ScanWarningCode::EntrySkipped,
                message: format!(
                    "Missing SKILL.md in {}",
                    normalize_path_for_serialization(&entry.entry_path)
                ),
                provider_id: provider_id_for_warnings.map(str::to_string),
                path: Some(normalize_path_for_serialization(&entry.entry_path)),
            });
            continue;
        };

        let Some(parsed) = parse_skill_md(&raw) else {
            warnings.push(ScanWarning {
                code: ScanWarningCode::EntrySkipped,
                message: format!(
                    "Invalid SKILL.md frontmatter in {}",
                    normalize_path_for_serialization(&entry.entry_path)
                ),
                provider_id: provider_id_for_warnings.map(str::to_string),
                path: Some(normalize_path_for_serialization(&entry.entry_path)),
            });
            continue;
        };

        if parsed.internal && !include_internal {
            warnings.push(ScanWarning {
                code: ScanWarningCode::EntrySkipped,
                message: format!("Skipped internal skill '{}'", parsed.name),
                provider_id: provider_id_for_warnings.map(str::to_string),
                path: Some(normalize_path_for_serialization(&entry.entry_path)),
            });
            continue;
        }

        skills.push((parsed.name, parsed.description, entry));
    }

    DirScanOutcome { skills, warnings }
}

fn merge_skill(
    map: &mut BTreeMap<String, ScannedSkill>,
    name: String,
    description: String,
    provider_id: &str,
    entry: SkillDirEntry,
) {
    let skill_key = format!("global:{name}");
    let skill_path = ScannedSkillPath {
        path: normalize_path_for_serialization(&entry.entry_path),
        original_path: entry
            .original_path
            .as_ref()
            .map(|p| normalize_path_for_serialization(p)),
    };
    if let Some(existing) = map.get_mut(&skill_key) {
        if !existing.provider_ids.iter().any(|id| id == provider_id) {
            existing.provider_ids.push(provider_id.to_string());
        }
        if !existing.paths.iter().any(|p| p.path == skill_path.path) {
            existing.paths.push(skill_path);
        }
    } else {
        map.insert(
            skill_key,
            ScannedSkill {
                name,
                description,
                scope: "global".into(),
                provider_ids: vec![provider_id.to_string()],
                paths: vec![skill_path],
            },
        );
    }
}

pub fn scan_installed(ctx: &ScanContext) -> Result<InstalledScanSnapshot, String> {
    let registry: RegistryFile = load_registry()?;
    let mut skills_map: BTreeMap<String, ScannedSkill> = BTreeMap::new();
    let mut warnings: Vec<ScanWarning> = Vec::new();

    let universal_dir = universal_skills_dir(&ctx.probe);
    let universal_exists = universal_dir.is_dir();
    let mut universal_count = 0u32;

    if universal_exists {
        let outcome = scan_skills_dir(
            &universal_dir,
            ctx.include_internal,
            Some(UNIVERSAL_PROVIDER_ID),
        );
        warnings.extend(outcome.warnings);
        for (name, description, path) in outcome.skills {
            universal_count += 1;
            merge_skill(
                &mut skills_map,
                name,
                description,
                UNIVERSAL_PROVIDER_ID,
                path,
            );
        }
    }

    if !universal_exists || universal_count == 0 {
        warnings.push(ScanWarning {
            code: if universal_exists {
                ScanWarningCode::UniversalEmpty
            } else {
                ScanWarningCode::SkillsDirMissing
            },
            message: if universal_exists {
                "Universal skills directory has no valid skills".into()
            } else {
                format!(
                    "Universal skills directory missing: {}",
                    normalize_path_for_serialization(&universal_dir)
                )
            },
            provider_id: Some(UNIVERSAL_PROVIDER_ID.into()),
            path: Some(normalize_path_for_serialization(&universal_dir)),
        });
    }

    let mut providers: Vec<ScannedProvider> = Vec::new();

    for provider in &registry.providers {
        let detected = evaluate_detection(&provider.detection, &ctx.probe);
        if !detected {
            continue;
        }

        let skills_dir = resolve_global_skills_dir(&provider.global_skills_dir, &ctx.probe);
        let has_global_skills_dir = !matches!(provider.global_skills_dir, GlobalSkillsDir::None);
        let skills_dir_exists = skills_dir.as_ref().map(|p| p.is_dir()).unwrap_or(false);
        let mut skill_count = 0u32;
        let mut emitted_missing_dir = false;

        if let Some(ref dir) = skills_dir {
            if skills_dir_exists {
                let outcome = scan_skills_dir(dir, ctx.include_internal, Some(&provider.id));
                warnings.extend(outcome.warnings);
                for (name, description, path) in outcome.skills {
                    skill_count += 1;
                    merge_skill(&mut skills_map, name, description, &provider.id, path);
                }
            } else {
                emitted_missing_dir = true;
                warnings.push(ScanWarning {
                    code: ScanWarningCode::SkillsDirMissing,
                    message: format!(
                        "Skills directory missing for {}: {}",
                        provider.display_name,
                        normalize_path_for_serialization(dir)
                    ),
                    provider_id: Some(provider.id.clone()),
                    path: Some(normalize_path_for_serialization(dir)),
                });
            }
        }

        // Providers with no global skills dir (e.g. Eve) are detected but not empty-warnable.
        if has_global_skills_dir && skill_count == 0 && !emitted_missing_dir {
            warnings.push(ScanWarning {
                code: ScanWarningCode::ProviderEmpty,
                message: format!(
                    "{} is detected but has no valid global skills",
                    provider.display_name
                ),
                provider_id: Some(provider.id.clone()),
                path: skills_dir
                    .as_ref()
                    .map(|p| normalize_path_for_serialization(p)),
            });
        }

        providers.push(ScannedProvider {
            id: provider.id.clone(),
            name: provider.display_name.clone(),
            universal: provider.universal,
            detected: true,
            skills_dir: skills_dir
                .as_ref()
                .map(|p| normalize_path_for_serialization(p)),
            skills_dir_exists,
            skill_count,
        });
    }

    providers.sort_by(|a, b| {
        b.skill_count
            .cmp(&a.skill_count)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    let skills: Vec<ScannedSkill> = skills_map.into_values().collect();

    Ok(InstalledScanSnapshot {
        scanned_at: ctx.scanned_at.clone().unwrap_or_else(scanned_at_timestamp),
        source: ProviderRegistrySourceMeta {
            repository_url: registry.source.repository_url,
            commit: registry.source.commit,
            license: registry.source.license,
            attribution: registry.source.attribution,
        },
        universal: UniversalScanInfo {
            skills_dir: normalize_path_for_serialization(&universal_dir),
            skills_dir_exists: universal_exists,
            skill_count: universal_count,
        },
        providers,
        skills,
        warnings,
    })
}

/// Resolve a provider (or Universal) skills directory without scanning skills.
pub fn resolve_provider_skills_dir(
    provider_id: &str,
    ctx: &ScanContext,
) -> Result<Option<PathBuf>, String> {
    if provider_id == UNIVERSAL_PROVIDER_ID {
        return Ok(Some(universal_skills_dir(&ctx.probe)));
    }
    let registry = load_registry()?;
    let Some(provider) = registry.providers.iter().find(|p| p.id == provider_id) else {
        return Ok(None);
    };
    Ok(resolve_global_skills_dir(
        &provider.global_skills_dir,
        &ctx.probe,
    ))
}

/// Reveal a skills directory in the system file manager. Returns false when missing.
pub fn reveal_skills_dir(path: &Path) -> Result<bool, String> {
    if !path.exists() {
        return Ok(false);
    }
    tauri_plugin_opener::reveal_item_in_dir(path)
        .map(|_| true)
        .map_err(|e| format!("Failed to reveal path: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

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
            "skills-explorer-scan-{label}-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn formats_unix_secs_as_rfc3339() {
        assert_eq!(unix_secs_to_rfc3339(0), "1970-01-01T00:00:00Z");
        assert_eq!(unix_secs_to_rfc3339(1_720_000_000), "2024-07-03T09:46:40Z");
    }

    #[test]
    fn scans_universal_and_provider_dirs_with_dedupe() {
        let home = temp_home("dedupe");
        let universal = home.join(".agents/skills");
        let claude = home.join(".claude");
        let claude_skills = claude.join("skills");
        fs::create_dir_all(&claude).unwrap();

        write_skill(&universal, "find-skills", "find-skills", "Find skills");
        write_skill(&claude_skills, "find-skills", "find-skills", "Find skills");
        write_skill(&claude_skills, "code-review", "code-review", "Review code");

        let snapshot = scan_installed(&scan_ctx(&home)).unwrap();

        assert!(snapshot
            .providers
            .iter()
            .any(|p| p.id == "claude-code" && p.skill_count == 2));
        assert_eq!(snapshot.universal.skill_count, 1);

        let find = snapshot
            .skills
            .iter()
            .find(|s| s.name == "find-skills")
            .expect("find-skills");
        assert!(find
            .provider_ids
            .contains(&UNIVERSAL_PROVIDER_ID.to_string()));
        assert!(find.provider_ids.contains(&"claude-code".to_string()));
        assert_eq!(find.paths.len(), 2);

        let review = snapshot
            .skills
            .iter()
            .find(|s| s.name == "code-review")
            .expect("code-review");
        assert_eq!(review.provider_ids, vec!["claude-code".to_string()]);
    }

    #[test]
    fn keeps_detected_provider_with_zero_skills_and_warning() {
        let home = temp_home("empty");
        fs::create_dir_all(home.join(".cursor")).unwrap();
        fs::create_dir_all(home.join(".cursor/skills")).unwrap();

        let snapshot = scan_installed(&scan_ctx(&home)).unwrap();
        let cursor = snapshot
            .providers
            .iter()
            .find(|p| p.id == "cursor")
            .expect("cursor detected");
        assert_eq!(cursor.skill_count, 0);
        assert!(snapshot.warnings.iter().any(|w| {
            w.code == ScanWarningCode::ProviderEmpty && w.provider_id.as_deref() == Some("cursor")
        }));
    }

    #[test]
    #[cfg(unix)]
    fn includes_symlink_skill_directories() {
        use std::os::unix::fs::symlink;

        let home = temp_home("symlink");
        let universal = home.join(".agents/skills");
        fs::create_dir_all(&universal).unwrap();
        let real = home.join("real-skill");
        write_skill(&home, "real-skill", "linked-skill", "Via symlink");
        symlink(&real, universal.join("linked-skill")).unwrap();

        let snapshot = scan_installed(&scan_ctx(&home)).unwrap();
        let linked = snapshot
            .skills
            .iter()
            .find(|s| s.name == "linked-skill")
            .expect("linked-skill");
        assert_eq!(snapshot.universal.skill_count, 1);
        assert_eq!(linked.paths.len(), 1);
        assert!(linked.paths[0].original_path.is_some());
    }

    #[test]
    fn skips_dot_folder_entries() {
        let home = temp_home("dotdir");
        let universal = home.join(".agents/skills");
        fs::create_dir_all(&universal).unwrap();
        write_skill(&universal, ".vscode", "hidden-skill", "Should not scan");
        write_skill(&universal, "real-skill", "real-skill", "Real skill");

        let snapshot = scan_installed(&scan_ctx(&home)).unwrap();
        assert_eq!(snapshot.universal.skill_count, 1);
        assert!(snapshot.skills.iter().any(|s| s.name == "real-skill"));
        assert!(!snapshot.skills.iter().any(|s| s.name == "hidden-skill"));
    }

    #[test]
    #[cfg(unix)]
    fn provider_skill_count_includes_symlinks() {
        use std::os::unix::fs::symlink;

        let home = temp_home("provider-symlink");
        fs::create_dir_all(home.join(".codebuddy")).unwrap();
        let skills_dir = home.join(".codebuddy/skills");
        fs::create_dir_all(&skills_dir).unwrap();
        let real = home.join("real-skill");
        write_skill(&home, "real-skill", "linked-skill", "Via symlink");
        symlink(&real, skills_dir.join("linked-skill")).unwrap();

        let snapshot = scan_installed(&scan_ctx(&home)).unwrap();
        let codebuddy = snapshot
            .providers
            .iter()
            .find(|p| p.id == "codebuddy")
            .expect("codebuddy detected");
        assert_eq!(codebuddy.skill_count, 1);
        let linked = snapshot
            .skills
            .iter()
            .find(|s| s.name == "linked-skill")
            .expect("linked-skill");
        assert!(linked.provider_ids.contains(&"codebuddy".to_string()));
        assert!(linked.paths.iter().any(|p| p.original_path.is_some()));
        assert!(!snapshot.warnings.iter().any(|w| {
            w.code == ScanWarningCode::ProviderEmpty
                && w.provider_id.as_deref() == Some("codebuddy")
        }));
    }

    #[test]
    fn skips_invalid_entries() {
        let home = temp_home("invalid");
        let universal = home.join(".agents/skills");
        fs::create_dir_all(universal.join("no-skill-md")).unwrap();
        fs::create_dir_all(universal.join("bad")).unwrap();
        fs::write(
            universal.join("bad").join("SKILL.md"),
            "---\nname: only\n---\n",
        )
        .unwrap();

        let snapshot = scan_installed(&scan_ctx(&home)).unwrap();
        assert!(snapshot.skills.is_empty());
        assert!(snapshot
            .warnings
            .iter()
            .any(|w| w.code == ScanWarningCode::EntrySkipped));
    }

    #[test]
    fn resolve_provider_skills_dir_does_not_require_detection() {
        let home = temp_home("resolve");
        let ctx = scan_ctx(&home);
        let path = resolve_provider_skills_dir("claude-code", &ctx)
            .unwrap()
            .unwrap();
        assert_eq!(path, home.join(".claude/skills"));

        let universal = resolve_provider_skills_dir(UNIVERSAL_PROVIDER_ID, &ctx)
            .unwrap()
            .unwrap();
        assert_eq!(universal, home.join(".agents/skills"));
    }

    #[test]
    fn provider_filters_use_direct_dir_not_universal_only() {
        let home = temp_home("direct");
        fs::create_dir_all(home.join(".claude")).unwrap();
        write_skill(
            &home.join(".agents/skills"),
            "only-universal",
            "only-universal",
            "Universal only",
        );

        let snapshot = scan_installed(&scan_ctx(&home)).unwrap();
        let claude = snapshot
            .providers
            .iter()
            .find(|p| p.id == "claude-code")
            .expect("claude");
        assert_eq!(claude.skill_count, 0);
        assert_eq!(snapshot.universal.skill_count, 1);
    }
}
