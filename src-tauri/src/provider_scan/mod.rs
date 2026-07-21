//! Global installed-skill scan using the vendored provider registry.

mod copy;
mod frontmatter;
mod paths;
mod scan;
mod types;

pub use copy::{copy_skill_to_providers, CopySkillToProvidersResult};
pub use scan::{
    delete_universal_skill_dir, resolve_provider_skills_dir, reveal_skills_dir, scan_installed,
    ScanContext,
};
pub use types::InstalledScanSnapshot;
