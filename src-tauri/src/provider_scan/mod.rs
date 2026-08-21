//! Global installed-skill scan using the vendored provider registry.

mod cache;
mod copy;
mod frontmatter;
mod install;
mod path_entry;
mod paths;
mod plugin;
mod plugin_manifest;
mod projection;
mod scan;
mod types;

pub use cache::scan_installed_cached;
pub use copy::{copy_skill_to_providers, CopySkillToProvidersResult};
pub use install::{install_skill, uninstall_skill, SkillProjectionResult};
pub use scan::{
    delete_universal_skill_dir, list_projects, resolve_provider_skills_dir, reveal_skills_dir,
    scan_project, ScanContext,
};
pub use types::{InstalledScanSnapshot, ProjectInfo};
