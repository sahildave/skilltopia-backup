//! Global installed-skill scan using the vendored provider registry.

mod copy;
mod frontmatter;
mod install;
mod path_entry;
mod paths;
/// Seam F: reads the Claude plugin manifest. Seam H joins it into the scan;
/// until then nothing calls it, hence the allow.
#[allow(dead_code)]
mod plugin_manifest;
mod projection;
mod scan;
mod types;

pub use copy::{copy_skill_to_providers, CopySkillToProvidersResult};
pub use install::{install_skill, uninstall_skill, SkillProjectionResult};
pub use scan::{
    delete_universal_skill_dir, list_projects, resolve_provider_skills_dir, reveal_skills_dir,
    scan_installed, scan_project, ScanContext,
};
pub use types::{InstalledScanSnapshot, ProjectInfo};
