//! Scan global skill directories and build a normalized snapshot.

use crate::utils::platform::normalize_path_for_serialization;
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::path::{Component, Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use super::frontmatter::parse_skill_md;
use super::paths::{
    evaluate_detection, load_registry, resolve_global_skills_dir, universal_skills_dir,
    GlobalSkillsDir, ProbeContext, RegistryFile,
};
use super::plugin::read_plugin_bundle;
use super::plugin_guard::PluginGuard;
use super::plugin_manifest::read_installed_plugins;
use super::types::{
    InstalledScanSnapshot, ProjectInfo, ProviderRegistrySourceMeta, ScanWarning, ScanWarningCode,
    ScannedProvider, ScannedSkill, ScannedSkillPath, SkillOrigin, UniversalScanInfo,
    CLAUDE_CODE_PROVIDER_ID, PROJECT_AGENTS_PROVIDER_ID, UNIVERSAL_PROVIDER_ID,
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

pub(crate) struct SkillDirEntry {
    /// Path as listed in the skills folder (may be a symlink).
    #[allow(dead_code)]
    pub(crate) entry_path: PathBuf,
    /// Directory containing `SKILL.md` (follows symlinks).
    pub(crate) content_root: PathBuf,
    /// Normalized resolved target when `entry_path` is a symlink.
    pub(crate) original_path: Option<PathBuf>,
}

fn resolve_symlink_target(link: &Path, target: &Path) -> Option<PathBuf> {
    if target.is_absolute() {
        Some(target.to_path_buf())
    } else {
        link.parent().map(|parent| parent.join(target))
    }
}

/// Accept real directories and directory symlinks in a skills folder.
pub(crate) fn classify_skill_entry(path: &Path) -> Option<SkillDirEntry> {
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
    scan_skills_dir_inner(
        dir,
        include_internal,
        provider_id_for_warnings,
        false,
        &mut BTreeSet::new(),
    )
}

fn scan_provider_skills_dir(
    dir: &Path,
    include_internal: bool,
    provider_id: &str,
) -> DirScanOutcome {
    let recursive = provider_id == "hermes-agent";
    let mut visited = BTreeSet::new();
    if recursive {
        visited.insert(fs::canonicalize(dir).unwrap_or_else(|_| dir.to_path_buf()));
    }
    scan_skills_dir_inner(
        dir,
        include_internal,
        Some(provider_id),
        recursive,
        &mut visited,
    )
}

fn scan_skills_dir_inner(
    dir: &Path,
    include_internal: bool,
    provider_id_for_warnings: Option<&str>,
    recursive: bool,
    visited: &mut BTreeSet<PathBuf>,
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
        let raw = match fs::read_to_string(&skill_md) {
            Ok(raw) => raw,
            Err(_) => {
                if recursive && !skill_md.exists() {
                    let canonical = fs::canonicalize(&entry.content_root)
                        .unwrap_or_else(|_| entry.content_root.clone());
                    if !visited.insert(canonical) {
                        continue;
                    }
                    let nested = scan_skills_dir_inner(
                        &entry.content_root,
                        include_internal,
                        provider_id_for_warnings,
                        true,
                        visited,
                    );
                    if !nested.skills.is_empty() || !nested.warnings.is_empty() {
                        skills.extend(nested.skills);
                        warnings.extend(nested.warnings);
                        continue;
                    }
                }
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
            }
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
    let uninstall_name = entry
        .entry_path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or(&name)
        .to_string();
    let skill_path = ScannedSkillPath {
        path: normalize_path_for_serialization(&entry.entry_path),
        original_path: entry
            .original_path
            .as_ref()
            .map(|p| normalize_path_for_serialization(p)),
    };
    merge_global_skill(
        map,
        name,
        description,
        uninstall_name,
        Some(provider_id),
        SkillOrigin::ProviderDirectory {
            provider_id: provider_id.to_string(),
        },
        skill_path,
    );
}

/// One skill name, one entry — regardless of how many directories or plugins
/// ship it. Every source folds into the same record, adding its provider id (if
/// it has one), its origin and its path.
fn merge_global_skill(
    map: &mut BTreeMap<String, ScannedSkill>,
    name: String,
    description: String,
    uninstall_name: String,
    provider_id: Option<&str>,
    origin: SkillOrigin,
    skill_path: ScannedSkillPath,
) {
    let skill_key = format!("global:{name}");
    if let Some(existing) = map.get_mut(&skill_key) {
        if let Some(provider_id) = provider_id {
            if !existing.provider_ids.iter().any(|id| id == provider_id) {
                existing.provider_ids.push(provider_id.to_string());
            }
        }
        if !existing.origins.contains(&origin) {
            existing.origins.push(origin);
        }
        if !existing.paths.iter().any(|p| p.path == skill_path.path) {
            existing.paths.push(skill_path);
        }
    } else {
        map.insert(
            skill_key,
            ScannedSkill {
                name,
                uninstall_name,
                description,
                scope: "global".into(),
                provider_ids: provider_id.map(str::to_string).into_iter().collect(),
                origins: vec![origin],
                paths: vec![skill_path],
            },
        );
    }
}

/// Fold every skill shipped by the active plugin installs into the same map the
/// provider directories filled. A skill present in both places gains a second
/// origin rather than a second entry.
///
/// Plugin skills are tagged with the Claude Code provider id because that agent
/// really does load them; without it the sidebar row for Claude Code would hide
/// the skills it invokes. They keep a `ClaudePlugin` origin, never a
/// `ProviderDirectory` one — the tag says who can invoke it, the origin says
/// where it came from.
fn merge_plugin_skills(
    map: &mut BTreeMap<String, ScannedSkill>,
    warnings: &mut Vec<ScanWarning>,
    home: &Path,
) {
    let scan = read_installed_plugins(&home.join(".claude").join("plugins"));
    warnings.extend(scan.warnings);

    for install in scan.installs {
        let bundle = read_plugin_bundle(&install.install_path);
        let version = install
            .version
            .clone()
            .or_else(|| bundle.manifest.version.clone())
            .unwrap_or_default();
        for skill in bundle.skills {
            let uninstall_name = Path::new(&skill.path)
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or(&skill.name)
                .to_string();
            merge_global_skill(
                map,
                skill.name,
                skill.description,
                uninstall_name,
                Some(CLAUDE_CODE_PROVIDER_ID),
                SkillOrigin::ClaudePlugin {
                    plugin: install.plugin.clone(),
                    marketplace: install.marketplace.clone().unwrap_or_default(),
                    version: version.clone(),
                },
                ScannedSkillPath {
                    path: skill.path,
                    original_path: None,
                },
            );
        }
    }
}

pub fn scan_installed(ctx: &ScanContext) -> Result<InstalledScanSnapshot, String> {
    let registry: RegistryFile = load_registry()?;
    let mut skills_map: BTreeMap<String, ScannedSkill> = BTreeMap::new();
    let mut warnings: Vec<ScanWarning> = Vec::new();

    let universal_dir = universal_skills_dir(&registry, &ctx.probe)?;
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

        // Providers that resolve to the Universal dir (e.g. Cline) share that tree —
        // do not double-scan; tag Universal skills and reuse the Universal count.
        let shares_universal_dir = skills_dir.as_ref().is_some_and(|dir| dir == &universal_dir);

        if shares_universal_dir {
            skill_count = universal_count;
            for skill in skills_map.values_mut() {
                if skill
                    .provider_ids
                    .iter()
                    .any(|id| id == UNIVERSAL_PROVIDER_ID)
                    && !skill.provider_ids.iter().any(|id| id == &provider.id)
                {
                    skill.provider_ids.push(provider.id.clone());
                    skill.origins.push(SkillOrigin::ProviderDirectory {
                        provider_id: provider.id.clone(),
                    });
                }
            }
        } else if let Some(ref dir) = skills_dir {
            if skills_dir_exists {
                let outcome = scan_provider_skills_dir(dir, ctx.include_internal, &provider.id);
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
        // Shared-Universal providers are covered by Universal empty/missing warnings.
        if has_global_skills_dir
            && !shares_universal_dir
            && skill_count == 0
            && !emitted_missing_dir
        {
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

    // Plugin skills join after the provider directories so a skill found in both
    // keeps its provider-directory record and merely gains a plugin origin.
    merge_plugin_skills(&mut skills_map, &mut warnings, &ctx.probe.home);

    // A plugin is not a skills dir, so the directory walk above never counted it.
    // Claude Code loads plugin skills all the same, so its count is every skill
    // tagged with it — deduped, so a skill in both places is still counted once.
    if let Some(claude) = providers
        .iter_mut()
        .find(|provider| provider.id == CLAUDE_CODE_PROVIDER_ID)
    {
        claude.skill_count = skills_map
            .values()
            .filter(|skill| {
                skill
                    .provider_ids
                    .iter()
                    .any(|id| id == CLAUDE_CODE_PROVIDER_ID)
            })
            .count() as u32;
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

fn project_marker(path: &Path) -> bool {
    [
        ".git",
        "package.json",
        "Cargo.toml",
        "pyproject.toml",
        "go.mod",
        "pom.xml",
        "requirements.txt",
        "composer.json",
    ]
    .iter()
    .any(|marker| path.join(marker).exists())
}

/// Count unique project-local skills without building a full scan snapshot.
fn count_project_skills(
    project_path: &Path,
    registry: &RegistryFile,
    include_internal: bool,
) -> u32 {
    let mut names = BTreeSet::new();
    let universal_dir = project_path.join(".agents/skills");
    if universal_dir.is_dir() {
        let outcome = scan_skills_dir(&universal_dir, include_internal, None);
        for (name, _, _) in outcome.skills {
            names.insert(name);
        }
    }
    for provider in &registry.providers {
        let skills_dir = project_path.join(&provider.skills_dir);
        if skills_dir == universal_dir || !skills_dir.is_dir() {
            continue;
        }
        let outcome = scan_provider_skills_dir(&skills_dir, include_internal, &provider.id);
        for (name, _, _) in outcome.skills {
            names.insert(name);
        }
    }
    names.len() as u32
}

/// Discover project directories one or two levels below the selected root.
/// A marked project stops traversal, preventing nested package directories from
/// being reported as separate projects.
pub fn list_projects(root: &Path, ctx: &ScanContext) -> Result<Vec<ProjectInfo>, String> {
    if !root.is_dir() {
        return Err(format!(
            "Coding folder is not a directory: {}",
            root.display()
        ));
    }

    let registry = load_registry()?;
    let mut marked = Vec::new();
    let mut unmarked = Vec::new();
    let first_level = fs::read_dir(root)
        .map_err(|e| format!("Failed to read coding folder: {e}"))?
        .flatten()
        .filter(|entry| entry.path().is_dir())
        .collect::<Vec<_>>();

    for first in first_level {
        let first_path = first.path();
        let first_is_project = project_marker(&first_path);
        if first_is_project {
            marked.push((first_path, 1));
            continue;
        }
        unmarked.push((first_path.clone(), 1));
        let Ok(entries) = fs::read_dir(&first_path) else {
            continue;
        };
        for second in entries.flatten().filter(|entry| entry.path().is_dir()) {
            let second_path = second.path();
            if project_marker(&second_path) {
                marked.push((second_path, 2));
            } else {
                unmarked.push((second_path, 2));
            }
        }
    }

    let candidates = if marked.is_empty() { unmarked } else { marked };
    let mut projects = candidates
        .into_iter()
        .filter_map(|(path, depth)| {
            let name = path.file_name()?.to_str()?.to_string();
            let skill_count = count_project_skills(&path, &registry, ctx.include_internal);
            Some(ProjectInfo {
                name,
                path: normalize_path_for_serialization(&path),
                depth,
                skill_count,
            })
        })
        .collect::<Vec<_>>();
    projects.sort_by_key(|a| a.name.to_lowercase());
    Ok(projects)
}

/// Scan the conventional project-local skill folders. This intentionally
/// avoids provider detection based on the user's home directory.
pub fn scan_project(
    project_path: &Path,
    ctx: &ScanContext,
) -> Result<InstalledScanSnapshot, String> {
    if !project_path.is_dir() {
        return Err(format!(
            "Project is not a directory: {}",
            project_path.display()
        ));
    }
    let registry = load_registry()?;
    let mut skills_map = BTreeMap::new();
    let mut warnings = Vec::new();
    let universal_dir = project_path.join(".agents/skills");
    let mut universal_count = 0;

    if universal_dir.is_dir() {
        let outcome = scan_skills_dir(
            &universal_dir,
            ctx.include_internal,
            Some(PROJECT_AGENTS_PROVIDER_ID),
        );
        warnings.extend(outcome.warnings);
        for (name, description, path) in outcome.skills {
            universal_count += 1;
            merge_project_skill(
                &mut skills_map,
                name,
                description,
                PROJECT_AGENTS_PROVIDER_ID,
                path,
            );
        }
    }
    if universal_count == 0 {
        warnings.push(ScanWarning {
            code: if universal_dir.is_dir() {
                ScanWarningCode::UniversalEmpty
            } else {
                ScanWarningCode::SkillsDirMissing
            },
            message: format!(
                "Project .agents/skills directory missing or empty: {}",
                normalize_path_for_serialization(&universal_dir)
            ),
            provider_id: Some(PROJECT_AGENTS_PROVIDER_ID.into()),
            path: Some(normalize_path_for_serialization(&universal_dir)),
        });
    }

    let mut providers = Vec::new();
    for provider in &registry.providers {
        let skills_dir = project_path.join(&provider.skills_dir);
        let shares_universal = skills_dir == universal_dir;
        let exists = skills_dir.is_dir();
        let mut count = 0;
        if shares_universal {
            count = universal_count;
            // Do not tag project `.agents` skills with global provider ids (cursor,
            // claude-code, registry `universal`, …). Those ids mean home installs.
        } else if exists {
            let outcome = scan_provider_skills_dir(&skills_dir, ctx.include_internal, &provider.id);
            warnings.extend(outcome.warnings);
            for (name, description, path) in outcome.skills {
                count += 1;
                merge_project_skill(&mut skills_map, name, description, &provider.id, path);
            }
        }
        if !exists && provider.skills_dir == ".agents/skills" {
            continue;
        }
        providers.push(ScannedProvider {
            id: provider.id.clone(),
            name: provider.display_name.clone(),
            universal: provider.universal,
            detected: exists,
            skills_dir: Some(normalize_path_for_serialization(&skills_dir)),
            skills_dir_exists: exists,
            skill_count: count,
        });
    }
    providers.sort_by(|a, b| {
        b.skill_count
            .cmp(&a.skill_count)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

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
            skills_dir_exists: universal_dir.is_dir(),
            skill_count: universal_count,
        },
        providers,
        skills: skills_map.into_values().collect(),
        warnings,
    })
}

fn merge_project_skill(
    map: &mut BTreeMap<String, ScannedSkill>,
    name: String,
    description: String,
    provider_id: &str,
    entry: SkillDirEntry,
) {
    let skill_path = ScannedSkillPath {
        path: normalize_path_for_serialization(&entry.entry_path),
        original_path: entry
            .original_path
            .as_ref()
            .map(|p| normalize_path_for_serialization(p)),
    };
    let key = format!("project:{name}");
    let origin = SkillOrigin::ProviderDirectory {
        provider_id: provider_id.to_string(),
    };
    if let Some(existing) = map.get_mut(&key) {
        if !existing.provider_ids.iter().any(|id| id == provider_id) {
            existing.provider_ids.push(provider_id.to_string());
        }
        if !existing.origins.contains(&origin) {
            existing.origins.push(origin);
        }
        if !existing.paths.iter().any(|p| p.path == skill_path.path) {
            existing.paths.push(skill_path);
        }
    } else {
        let uninstall_name = entry
            .entry_path
            .file_name()
            .and_then(|v| v.to_str())
            .unwrap_or(&name)
            .to_string();
        map.insert(
            key,
            ScannedSkill {
                name,
                uninstall_name,
                description,
                scope: "project".into(),
                provider_ids: vec![provider_id.to_string()],
                origins: vec![origin],
                paths: vec![skill_path],
            },
        );
    }
}

/// Resolve a provider (or Universal) skills directory without scanning skills.
pub fn resolve_provider_skills_dir(
    provider_id: &str,
    ctx: &ScanContext,
) -> Result<Option<PathBuf>, String> {
    let registry = load_registry()?;
    if provider_id == UNIVERSAL_PROVIDER_ID {
        return Ok(Some(universal_skills_dir(&registry, &ctx.probe)?));
    }
    let Some(provider) = registry.providers.iter().find(|p| p.id == provider_id) else {
        return Ok(None);
    };
    Ok(resolve_global_skills_dir(
        &provider.global_skills_dir,
        &ctx.probe,
    ))
}

pub(crate) fn validate_skill_dir_name(uninstall_name: &str) -> Result<(), String> {
    let path = Path::new(uninstall_name);
    let mut components = path.components();
    let Some(Component::Normal(name)) = components.next() else {
        return Err("Skill folder name must be a single path segment".into());
    };
    if components.next().is_some() || name.is_empty() {
        return Err("Skill folder name must be a single path segment".into());
    }
    if uninstall_name == "." || uninstall_name == ".." {
        return Err("Skill folder name cannot be a relative path marker".into());
    }
    Ok(())
}

/// Delete one skill folder from the Universal `~/.agents/skills` cache.
/// Returns false when the skill folder is already missing.
pub fn delete_universal_skill_dir(uninstall_name: &str, ctx: &ScanContext) -> Result<bool, String> {
    validate_skill_dir_name(uninstall_name)?;

    let universal_dir = universal_skills_dir(&load_registry()?, &ctx.probe)?;
    let target = universal_dir.join(uninstall_name);
    // A Universal root that resolves into the plugin cache would make this a
    // delete against content we do not own.
    PluginGuard::for_context(ctx).refuse_write(&target)?;
    let metadata = match fs::symlink_metadata(&target) {
        Ok(metadata) => metadata,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(e) => {
            return Err(format!(
                "Failed to inspect Universal skill folder '{}': {e}",
                normalize_path_for_serialization(&target)
            ));
        }
    };

    if metadata.file_type().is_symlink() || metadata.is_file() {
        fs::remove_file(&target).map_err(|e| {
            format!(
                "Failed to delete Universal skill link '{}': {e}",
                normalize_path_for_serialization(&target)
            )
        })?;
        return Ok(true);
    }

    if !metadata.is_dir() {
        return Err(format!(
            "Universal skill path is not a directory: {}",
            normalize_path_for_serialization(&target)
        ));
    }

    fs::remove_dir_all(&target).map_err(|e| {
        format!(
            "Failed to delete Universal skill folder '{}': {e}",
            normalize_path_for_serialization(&target)
        )
    })?;
    Ok(true)
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
            "skilltopia-scan-{label}-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn discovers_marked_projects_at_depth_one_and_two() {
        let root = temp_home("projects");
        fs::create_dir_all(root.join("direct/.git")).unwrap();
        fs::create_dir_all(root.join("projects/nested")).unwrap();
        fs::write(root.join("projects/nested/package.json"), "{}").unwrap();
        fs::create_dir_all(root.join("projects/not-a-project")).unwrap();

        let projects = list_projects(&root, &scan_ctx(&root)).unwrap();
        assert_eq!(projects.len(), 2);
        assert_eq!(projects[0].depth, 1);
        assert_eq!(projects[1].depth, 2);
        assert_eq!(projects[0].skill_count, 0);
        assert_eq!(projects[1].skill_count, 0);
    }

    #[test]
    fn list_projects_counts_project_local_skills() {
        let root = temp_home("projects-skills");
        fs::create_dir_all(root.join("with-skills/.git")).unwrap();
        write_skill(
            &root.join("with-skills/.agents/skills"),
            "local-skill",
            "local-skill",
            "Project skill",
        );
        fs::create_dir_all(root.join("empty/.git")).unwrap();

        let projects = list_projects(&root, &scan_ctx(&root)).unwrap();
        assert_eq!(projects.len(), 2);
        let with_skills = projects.iter().find(|p| p.name == "with-skills").unwrap();
        let empty = projects.iter().find(|p| p.name == "empty").unwrap();
        assert_eq!(with_skills.skill_count, 1);
        assert_eq!(empty.skill_count, 0);
    }

    #[test]
    fn scans_project_agents_skills_with_project_scope() {
        let root = temp_home("project-scan");
        let project = root.join("project");
        write_skill(
            &project.join(".agents/skills"),
            "local-skill",
            "local-skill",
            "Project skill",
        );

        let snapshot = scan_project(&project, &scan_ctx(&root)).unwrap();
        assert_eq!(snapshot.skills.len(), 1);
        assert_eq!(snapshot.skills[0].scope, "project");
        assert!(snapshot.skills[0]
            .provider_ids
            .contains(&PROJECT_AGENTS_PROVIDER_ID.to_string()));
        assert!(!snapshot.skills[0]
            .provider_ids
            .contains(&UNIVERSAL_PROVIDER_ID.to_string()));
        assert_eq!(
            snapshot.skills[0].provider_ids,
            vec![PROJECT_AGENTS_PROVIDER_ID.to_string()]
        );
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
        // One provider-directory origin per directory the skill was found in.
        assert_eq!(
            find.origins,
            vec![
                SkillOrigin::ProviderDirectory {
                    provider_id: UNIVERSAL_PROVIDER_ID.to_string(),
                },
                SkillOrigin::ProviderDirectory {
                    provider_id: "claude-code".to_string(),
                },
            ]
        );

        let review = snapshot
            .skills
            .iter()
            .find(|s| s.name == "code-review")
            .expect("code-review");
        assert_eq!(review.provider_ids, vec!["claude-code".to_string()]);
        assert_eq!(
            review.origins,
            vec![SkillOrigin::ProviderDirectory {
                provider_id: "claude-code".to_string(),
            }]
        );
    }

    /// The six registry providers whose `globalSkillsDir` is the Universal root.
    /// They must be attributed to the Universal scan, never re-scanned.
    #[test]
    fn attributes_universal_sharing_providers_without_rescanning() {
        let home = temp_home("shared-universal");
        let universal = home.join(".agents/skills");
        write_skill(&universal, "shared-skill", "shared-skill", "Shared");

        // Detection markers, one per provider (zed probes configHome, not $HOME).
        for marker in [".cline", ".dexto", ".kimi-code", ".loaf", ".warp"] {
            fs::create_dir_all(home.join(marker)).unwrap();
        }
        fs::create_dir_all(home.join(".config/zed")).unwrap();

        let snapshot = scan_installed(&scan_ctx(&home)).unwrap();
        let universal_dir = normalize_path_for_serialization(&universal);
        assert_eq!(snapshot.universal.skill_count, 1);

        let skill = snapshot
            .skills
            .iter()
            .find(|s| s.name == "shared-skill")
            .expect("shared-skill");
        // One path, not six: the shared tree was walked exactly once.
        assert_eq!(skill.paths.len(), 1);

        for id in ["cline", "dexto", "kimi-code-cli", "loaf", "warp", "zed"] {
            let provider = snapshot
                .providers
                .iter()
                .find(|p| p.id == id)
                .unwrap_or_else(|| panic!("{id} missing from snapshot"));
            assert!(provider.detected, "{id} should be detected");
            assert_eq!(provider.skills_dir.as_deref(), Some(universal_dir.as_str()));
            assert_eq!(provider.skill_count, 1, "{id} should reuse Universal count");
            assert!(
                skill.provider_ids.iter().any(|p| p == id),
                "{id} should be attributed to the Universal skill"
            );
            assert!(
                !snapshot
                    .warnings
                    .iter()
                    .any(|w| w.provider_id.as_deref() == Some(id)),
                "{id} should inherit Universal warnings, not raise its own"
            );
        }
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
    fn scans_hermes_category_directories_recursively() {
        let home = temp_home("hermes-categories");
        let hermes_skills = home.join(".hermes/skills");
        let category = hermes_skills.join("mlops/inference");
        write_skill(
            &category,
            "serving-llms-vllm",
            "serving-llms-vllm",
            "Serve language models",
        );

        let snapshot = scan_installed(&scan_ctx(&home)).unwrap();
        let hermes = snapshot
            .providers
            .iter()
            .find(|provider| provider.id == "hermes-agent")
            .expect("Hermes detected");
        let skill = snapshot
            .skills
            .iter()
            .find(|skill| skill.name == "serving-llms-vllm")
            .expect("nested Hermes skill");

        assert_eq!(hermes.skill_count, 1);
        assert!(skill.provider_ids.contains(&"hermes-agent".to_string()));
        assert!(snapshot.warnings.iter().all(|warning| {
            warning.provider_id.as_deref() != Some("hermes-agent")
                || warning.path.as_deref()
                    != Some(normalize_path_for_serialization(&category).as_str())
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

    #[test]
    fn shared_universal_dir_provider_tags_without_double_scan() {
        let home = temp_home("shared-universal");
        fs::create_dir_all(home.join(".cline")).unwrap();
        write_skill(
            &home.join(".agents/skills"),
            "shared-skill",
            "shared-skill",
            "Shared with Cline",
        );

        let snapshot = scan_installed(&scan_ctx(&home)).unwrap();
        let cline = snapshot
            .providers
            .iter()
            .find(|p| p.id == "cline")
            .expect("cline detected");
        assert_eq!(cline.skill_count, 1);
        assert_eq!(
            cline.skills_dir,
            Some(normalize_path_for_serialization(
                &home.join(".agents/skills")
            ))
        );
        assert_eq!(snapshot.universal.skill_count, 1);

        let skill = snapshot
            .skills
            .iter()
            .find(|s| s.name == "shared-skill")
            .expect("shared-skill");
        assert!(skill
            .provider_ids
            .contains(&UNIVERSAL_PROVIDER_ID.to_string()));
        assert!(skill.provider_ids.contains(&"cline".to_string()));
        assert_eq!(skill.paths.len(), 1);
        assert!(!snapshot.warnings.iter().any(|w| {
            w.code == ScanWarningCode::ProviderEmpty && w.provider_id.as_deref() == Some("cline")
        }));
    }

    #[test]
    fn deletes_universal_skill_dir_by_single_folder_name() {
        let home = temp_home("delete-universal");
        let universal = home.join(".agents/skills");
        write_skill(&universal, "find-skills", "find-skills", "Find skills");

        assert!(delete_universal_skill_dir("find-skills", &scan_ctx(&home)).unwrap());
        assert!(!universal.join("find-skills").exists());
        assert!(!delete_universal_skill_dir("find-skills", &scan_ctx(&home)).unwrap());
    }

    #[test]
    fn rejects_universal_delete_path_traversal() {
        let home = temp_home("delete-traversal");
        let err = delete_universal_skill_dir("../outside", &scan_ctx(&home)).unwrap_err();

        assert!(err.contains("single path segment"));
    }

    #[test]
    #[cfg(unix)]
    fn deletes_universal_skill_symlink_without_following_target() {
        use std::os::unix::fs::symlink;

        let home = temp_home("delete-symlink");
        let universal = home.join(".agents/skills");
        fs::create_dir_all(&universal).unwrap();
        let real = home.join("real-skill");
        write_skill(&home, "real-skill", "linked-skill", "Via symlink");
        symlink(&real, universal.join("linked-skill")).unwrap();

        assert!(delete_universal_skill_dir("linked-skill", &scan_ctx(&home)).unwrap());
        assert!(!universal.join("linked-skill").exists());
        assert!(real.exists());
    }

    /// Install one plugin under `~/.claude/plugins` with the given skills and
    /// register it in the manifest. Returns the install path.
    fn write_plugin(home: &Path, key: &str, version: Option<&str>, skills: &[&str]) -> PathBuf {
        let install = home
            .join(".claude/plugins/cache")
            .join(key.replace('/', "-"));
        for skill in skills {
            write_skill(&install.join("skills"), skill, skill, "From a plugin");
        }
        fs::create_dir_all(install.join(".claude-plugin")).unwrap();
        fs::write(
            install.join(".claude-plugin/plugin.json"),
            r#"{"name":"manifest-name","version":"9.9.9"}"#,
        )
        .unwrap();

        let version_field = version
            .map(|v| format!(r#""version":"{v}","#))
            .unwrap_or_default();
        let manifest = format!(
            r#"{{"version":2,"plugins":{{"{key}":[{{"scope":"user",{version_field}"installPath":"{}","lastUpdated":"2026-01-01T00:00:00.000Z"}}]}}}}"#,
            install.to_string_lossy()
        );
        fs::write(
            home.join(".claude/plugins/installed_plugins.json"),
            manifest,
        )
        .unwrap();
        install
    }

    #[test]
    fn plugin_skills_join_the_snapshot_with_provenance() {
        let home = temp_home("plugin-join");
        write_plugin(&home, "ponytail@official", Some("1.2.0"), &["ponytail"]);

        let snapshot = scan_installed(&scan_ctx(&home)).unwrap();
        let skill = snapshot
            .skills
            .iter()
            .find(|s| s.name == "ponytail")
            .expect("plugin skill in snapshot");
        assert_eq!(
            skill.origins,
            vec![SkillOrigin::ClaudePlugin {
                plugin: "ponytail".into(),
                marketplace: "official".into(),
                version: "1.2.0".into(),
            }]
        );
        assert_eq!(skill.uninstall_name, "ponytail");
        // Tagged for Claude Code, which loads it, without gaining a
        // ProviderDirectory origin — it still came from a plugin.
        assert_eq!(skill.provider_ids, vec!["claude-code".to_string()]);
        assert_eq!(skill.paths.len(), 1);
        assert!(skill.paths[0].path.ends_with("skills/ponytail"));
    }

    #[test]
    fn plugin_version_falls_back_to_the_plugin_manifest() {
        let home = temp_home("plugin-version");
        write_plugin(&home, "ponytail@official", None, &["ponytail"]);

        let snapshot = scan_installed(&scan_ctx(&home)).unwrap();
        let skill = snapshot
            .skills
            .iter()
            .find(|s| s.name == "ponytail")
            .unwrap();
        assert_eq!(
            skill.origins,
            vec![SkillOrigin::ClaudePlugin {
                plugin: "ponytail".into(),
                marketplace: "official".into(),
                version: "9.9.9".into(),
            }]
        );
    }

    #[test]
    fn skill_in_both_a_provider_dir_and_a_plugin_appears_once() {
        let home = temp_home("plugin-dedupe");
        let claude_skills = home.join(".claude/skills");
        write_skill(&claude_skills, "shared", "shared", "From Claude");
        write_plugin(&home, "ponytail@official", Some("1.2.0"), &["shared"]);

        let snapshot = scan_installed(&scan_ctx(&home)).unwrap();
        let matches: Vec<&ScannedSkill> = snapshot
            .skills
            .iter()
            .filter(|s| s.name == "shared")
            .collect();
        assert_eq!(matches.len(), 1, "one entry, two origins");
        let skill = matches[0];
        assert_eq!(skill.provider_ids, vec!["claude-code".to_string()]);
        assert_eq!(
            skill.origins,
            vec![
                SkillOrigin::ProviderDirectory {
                    provider_id: "claude-code".into(),
                },
                SkillOrigin::ClaudePlugin {
                    plugin: "ponytail".into(),
                    marketplace: "official".into(),
                    version: "1.2.0".into(),
                },
            ]
        );
        assert_eq!(skill.paths.len(), 2);
        // Counted once, not twice, despite living in both places.
        let claude = snapshot
            .providers
            .iter()
            .find(|p| p.id == "claude-code")
            .expect("claude-code");
        assert_eq!(claude.skill_count, 1);
    }

    #[test]
    fn claude_code_counts_and_lists_the_plugin_skills_it_loads() {
        let home = temp_home("plugin-provider-count");
        write_skill(&home.join(".claude/skills"), "own", "own", "From Claude");
        write_plugin(&home, "ponytail@official", Some("1.2.0"), &["shipped"]);

        let snapshot = scan_installed(&scan_ctx(&home)).unwrap();

        let shipped = snapshot
            .skills
            .iter()
            .find(|s| s.name == "shipped")
            .expect("plugin skill in the snapshot");
        assert_eq!(shipped.provider_ids, vec!["claude-code".to_string()]);
        // Tagged for the agent that loads it, but still a plugin by origin.
        assert!(matches!(
            shipped.origins.as_slice(),
            [SkillOrigin::ClaudePlugin { .. }]
        ));

        let claude = snapshot
            .providers
            .iter()
            .find(|p| p.id == "claude-code")
            .expect("claude-code");
        assert_eq!(claude.skill_count, 2, "its own dir plus the plugin skill");
    }

    #[test]
    fn unreadable_plugin_manifest_warns_without_failing_the_scan() {
        let home = temp_home("plugin-broken-manifest");
        write_plugin(&home, "ponytail@official", Some("1.2.0"), &["ponytail"]);
        fs::write(
            home.join(".claude/plugins/installed_plugins.json"),
            "{ not json",
        )
        .unwrap();

        let snapshot = scan_installed(&scan_ctx(&home)).unwrap();
        assert!(!snapshot.skills.iter().any(|s| s.name == "ponytail"));
        assert!(snapshot
            .warnings
            .iter()
            .any(|w| w.message.contains("installed_plugins.json")));
    }
}
