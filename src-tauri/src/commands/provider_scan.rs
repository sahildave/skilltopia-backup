//! Tauri commands for installed-skill scanning and reveal.

use tauri::{AppHandle, Manager};

use crate::provider_scan::{
    copy_skill_to_providers as copy_skill_to_providers_impl, delete_universal_skill_dir,
    install_skill as install_skill_impl, list_projects as list_projects_impl,
    resolve_provider_skills_dir, reveal_skills_dir, scan_installed_cached, scan_project,
    uninstall_skill as uninstall_skill_impl, CopySkillToProvidersResult, InstalledScanSnapshot,
    ProjectInfo, ScanContext, SkillProjectionResult,
};

/// Scan global provider + Universal skill directories into one normalized snapshot.
/// Served from cache while a stat-only fingerprint of those directories is
/// unchanged, so the Installed tab's rescan-per-activation is not a full walk.
#[tauri::command(async)]
#[specta::specta]
pub fn scan_installed_skills() -> Result<InstalledScanSnapshot, String> {
    scan_installed_cached(&ScanContext::from_environment())
}

/// Enumerate project directories at depth one or two below an explicitly selected root.
#[tauri::command(async)]
#[specta::specta]
pub fn list_projects(root: String) -> Result<Vec<ProjectInfo>, String> {
    list_projects_impl(
        std::path::Path::new(&root),
        &ScanContext::from_environment(),
    )
}

/// Scan project-local Universal and provider skill folders.
#[tauri::command(async)]
#[specta::specta]
pub fn scan_project_skills(project_path: String) -> Result<InstalledScanSnapshot, String> {
    scan_project(
        std::path::Path::new(&project_path),
        &ScanContext::from_environment(),
    )
}

/// Reveal a provider (or `universal`) skills directory in Finder/Explorer.
/// Returns `false` when the directory is missing. Does not rescan skills.
#[tauri::command]
#[specta::specta]
pub fn reveal_provider_skills_dir(provider_id: String) -> Result<bool, String> {
    let ctx = ScanContext::from_environment();
    let Some(path) = resolve_provider_skills_dir(&provider_id, &ctx)? else {
        return Ok(false);
    };
    reveal_skills_dir(&path)
}

/// Reveal an arbitrary filesystem path in Finder/Explorer.
/// Returns `false` when the path is missing. Does not rescan skills.
#[tauri::command]
#[specta::specta]
pub fn reveal_path(path: String) -> Result<bool, String> {
    reveal_skills_dir(std::path::Path::new(&path))
}

/// Delete one skill folder from the Universal `~/.agents/skills` cache.
/// Returns `false` when the folder is already missing.
#[tauri::command(async)]
#[specta::specta]
pub fn delete_universal_skill(uninstall_name: String) -> Result<bool, String> {
    delete_universal_skill_dir(&uninstall_name, &ScanContext::from_environment())
}

/// Copy one installed skill into selected provider folders as directory symlinks.
/// Returns independent per-provider outcomes so partial success is preserved.
#[tauri::command(async)]
#[specta::specta]
pub fn copy_skill_to_providers(
    uninstall_name: String,
    provider_ids: Vec<String>,
) -> Result<CopySkillToProvidersResult, String> {
    copy_skill_to_providers_impl(
        &uninstall_name,
        &provider_ids,
        &ScanContext::from_environment(),
    )
}

/// Where acquired skill sources are cached between installs.
fn skill_cache_root(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_cache_dir()
        .map(|dir| dir.join("skill-sources"))
        .map_err(|e| format!("Failed to resolve the app cache directory: {e}"))
}

/// Install one skill from `source` into Universal and the given providers.
/// Spawns no subprocess; a source already in the cache installs without network.
/// `project_path` selects project scope, `null` installs into the home roots.
#[tauri::command(async)]
#[specta::specta]
pub fn install_skill(
    app: AppHandle,
    source: String,
    skill_name: String,
    provider_ids: Vec<String>,
    project_path: Option<String>,
) -> Result<SkillProjectionResult, String> {
    install_skill_impl(
        &source,
        &skill_name,
        &provider_ids,
        project_path.as_deref().map(std::path::Path::new),
        &skill_cache_root(&app)?,
        &ScanContext::from_environment(),
    )
}

/// Remove one skill from each given target, `universal` included when the
/// caller lists it. Outcomes are independent: a failing target never stops the
/// rest, so the Universal cleanup always runs.
#[tauri::command(async)]
#[specta::specta]
pub fn uninstall_skill(
    uninstall_name: String,
    provider_ids: Vec<String>,
) -> Result<SkillProjectionResult, String> {
    uninstall_skill_impl(
        &uninstall_name,
        &provider_ids,
        &ScanContext::from_environment(),
    )
}
