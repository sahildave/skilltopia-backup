//! Shared scan snapshot types (specta-compatible for Tauri bindings).

use serde::{Deserialize, Serialize};
use specta::Type;

/// Synthetic id for skills found under `~/.agents/skills`.
pub const UNIVERSAL_PROVIDER_ID: &str = "universal";

/// Synthetic id for skills found under `<project>/.agents/skills`.
/// Not Universal — that label is reserved for `$HOME/.agents/skills`.
pub const PROJECT_AGENTS_PROVIDER_ID: &str = "project-agents";

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProviderRegistrySourceMeta {
    pub repository_url: String,
    pub commit: String,
    pub license: String,
    pub attribution: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ScanWarningCode {
    ProviderEmpty,
    SkillsDirMissing,
    EntrySkipped,
    UniversalEmpty,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScanWarning {
    pub code: ScanWarningCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub provider_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScannedProvider {
    pub id: String,
    pub name: String,
    pub universal: bool,
    pub detected: bool,
    pub skills_dir: Option<String>,
    pub skills_dir_exists: bool,
    pub skill_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ScannedSkillPath {
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub original_path: Option<String>,
}

/// Where a scanned skill came from. A skill can have several origins at once —
/// the same skill may sit in `~/.agents/skills` and also ship inside a plugin.
#[derive(Debug, Clone, Serialize, Deserialize, Type, PartialEq, Eq)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum SkillOrigin {
    /// Found directly in a provider (or Universal / project) skills directory.
    ProviderDirectory {
        #[serde(rename = "providerId")]
        provider_id: String,
    },
    /// Delivered by a Claude Code plugin.
    ClaudePlugin {
        plugin: String,
        marketplace: String,
        version: String,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ScannedSkill {
    pub name: String,
    pub uninstall_name: String,
    pub description: String,
    pub scope: String,
    pub provider_ids: Vec<String>,
    pub origins: Vec<SkillOrigin>,
    pub paths: Vec<ScannedSkillPath>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct UniversalScanInfo {
    pub skills_dir: String,
    pub skills_dir_exists: bool,
    pub skill_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct InstalledScanSnapshot {
    pub scanned_at: String,
    pub source: ProviderRegistrySourceMeta,
    pub universal: UniversalScanInfo,
    pub providers: Vec<ScannedProvider>,
    pub skills: Vec<ScannedSkill>,
    pub warnings: Vec<ScanWarning>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub name: String,
    pub path: String,
    pub depth: u8,
    pub skill_count: u32,
}
