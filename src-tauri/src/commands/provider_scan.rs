//! Tauri commands for installed-skill scanning and reveal.

use crate::provider_scan::{
    copy_skill_to_providers as copy_skill_to_providers_impl, delete_universal_skill_dir,
    list_projects as list_projects_impl, resolve_provider_skills_dir, reveal_skills_dir,
    scan_installed, scan_project, CopySkillToProvidersResult, InstalledScanSnapshot, ProjectInfo,
    ScanContext,
};

/// Scan global provider + Universal skill directories into one normalized snapshot.
#[tauri::command]
#[specta::specta]
pub fn scan_installed_skills() -> Result<InstalledScanSnapshot, String> {
    scan_installed(&ScanContext::from_environment())
}

/// Enumerate project directories at depth one or two below an explicitly selected root.
#[tauri::command]
#[specta::specta]
pub fn list_projects(root: String) -> Result<Vec<ProjectInfo>, String> {
    list_projects_impl(
        std::path::Path::new(&root),
        &ScanContext::from_environment(),
    )
}

/// Scan project-local Universal and provider skill folders.
#[tauri::command]
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
#[tauri::command]
#[specta::specta]
pub fn delete_universal_skill(uninstall_name: String) -> Result<bool, String> {
    delete_universal_skill_dir(&uninstall_name, &ScanContext::from_environment())
}

/// Copy one installed skill into selected provider folders as directory symlinks.
/// Returns independent per-provider outcomes so partial success is preserved.
#[tauri::command]
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
