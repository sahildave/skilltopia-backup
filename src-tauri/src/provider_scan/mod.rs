//! Global installed-skill scan using the vendored provider registry.

mod copy;
mod frontmatter;
/// Seam B foundation. Ships ahead of its caller (Seam D makes install
/// authoritative), so nothing in the tree reads these verdicts yet.
#[allow(dead_code)]
mod path_entry;
mod paths;
mod scan;
mod types;

pub use copy::{copy_skill_to_providers, CopySkillToProvidersResult};
pub use scan::{
    delete_universal_skill_dir, list_projects, resolve_provider_skills_dir, reveal_skills_dir,
    scan_installed, scan_project, ScanContext,
};
pub use types::{InstalledScanSnapshot, ProjectInfo};
