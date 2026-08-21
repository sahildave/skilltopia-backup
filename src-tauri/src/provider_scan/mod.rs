//! Global installed-skill scan using the vendored provider registry.

mod copy;
mod frontmatter;
mod install;
mod path_entry;
mod paths;
mod plugin;
mod projection;
mod scan;
mod types;

pub use copy::{copy_skill_to_providers, CopySkillToProvidersResult};
pub use install::{install_skill, uninstall_skill, SkillProjectionResult};
// Seam G: no caller until the plugin scan (Seam F) wires it in.
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
