//! Global installed-skill scan using the vendored provider registry.

mod copy;
mod frontmatter;
mod install;
mod path_entry;
mod paths;
mod plugin;
/// Seam F: reads the Claude plugin manifest. Seam H joins it into the scan;
/// until then nothing calls it, hence the allow.
#[allow(dead_code)]
mod plugin_manifest;
mod projection;
mod scan;
mod types;

pub use copy::{copy_skill_to_providers, CopySkillToProvidersResult};
pub use install::{install_skill, uninstall_skill, SkillProjectionResult};
// Seam G: no caller until Seam H joins the plugin scan into the snapshot.
#[allow(unused_imports)]
pub use plugin::{
    read_plugin_bundle, read_plugin_manifest, read_plugin_skills, PluginBundle, PluginManifest,
    PluginSkill,
};
pub use scan::{
    delete_universal_skill_dir, list_projects, resolve_provider_skills_dir, reveal_skills_dir,
    scan_installed, scan_project, ScanContext,
};
pub use types::{InstalledScanSnapshot, ProjectInfo};
