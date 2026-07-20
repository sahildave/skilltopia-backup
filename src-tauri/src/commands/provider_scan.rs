//! Tauri commands for installed-skill scanning and reveal.

use crate::provider_scan::{
    resolve_provider_skills_dir, reveal_skills_dir, scan_installed, InstalledScanSnapshot,
    ScanContext,
};

/// Scan global provider + Universal skill directories into one normalized snapshot.
#[tauri::command]
#[specta::specta]
pub fn scan_installed_skills() -> Result<InstalledScanSnapshot, String> {
    scan_installed(&ScanContext::from_environment())
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
