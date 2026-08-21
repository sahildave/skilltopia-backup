//! Seam D: put a skill bundle into a skills directory, and take it out again.
//!
//! One module owns every write to a provider (or Universal) skills root, so the
//! guards below exist once rather than once per caller. Install, the copy
//! fan-out and uninstall all go through here, and none of them spawns a
//! subprocess — the `npx skills add` / `npx skills remove` halves cost ~1.4 s
//! per provider, sequentially, which is where the ~60 s uninstall came from.
//!
//! ## Invariants
//!
//! - **Install is authoritative.** Any prior entry at the destination — stale
//!   link, dangling link, legacy real directory — is removed and re-written,
//!   never refused. A dangling link is something we wrote and can repair; the
//!   old `exists`-style check called it a conflict and stranded it forever.
//! - **Guards compare ROOTS, never the destination.** A host root that resolves
//!   onto the source's own root (`~/.claude/skills -> ~/.agents/skills`, and the
//!   six providers that declare `~/.agents/skills` outright) must never be
//!   written through: the rm would delete the real bundle and the link that
//!   replaced it would point at its own path. Once that cycle exists on disk
//!   `canonicalize` starts failing, so a destination-level check can no longer
//!   see the collision — the root-level one still can.
//! - **Uninstall uses `lstat`.** A dangling projection link must be *detected*
//!   and removed. `exists()` follows the link, sees the missing target, reports
//!   false, and leaves the orphan behind.
//! - **Per-target outcomes are independent.** One failing target never aborts
//!   the rest, and never skips the Universal cleanup that follows.
//!
//! ## Deviation from the reference
//!
//! open-knowledge has two entry points: `projectSkill` replaces whatever it
//! finds, `projectInPlaceSkill` refuses to clobber a *different* real directory
//! (a user's own fork). Both behaviours are real, so they are a parameter here
//! ({@link ForeignDirPolicy}) rather than two near-identical loops: an explicit
//! install replaces, the copy fan-out refuses.
//!
//! Ported from `skill-projection.ts` in inkeep/open-knowledge (commit
//! `53dbab202cb7`).

use std::fs;
use std::path::{Path, PathBuf};

use crate::utils::platform::normalize_path_for_serialization;

use super::path_entry::{inspect_skill_path_entry, DirIdentity, SkillPathEntry};

/// How the bundle is written into a skills root.
///
/// The seam is the point: a symlink is right for a fan-out inside one machine,
/// but a committed symlink needs `core.symlinks` on Windows, so anything meant
/// to travel has to be able to hold its own bytes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ProjectionMode {
    Symlink,
    Copy,
}

/// What to do about a real directory at the destination that is neither the
/// source nor a byte-for-byte copy of it.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ForeignDirPolicy {
    /// The user asked to install this skill here. Replace it.
    Replace,
    /// A fan-out of an already-installed skill. Someone else's directory is not
    /// ours to delete — report it and move on.
    Refuse,
}

/// One place a projection can be written: a skills root plus the id to report
/// the outcome under.
#[derive(Debug, Clone)]
pub(crate) struct ProjectionTarget {
    pub id: String,
    pub root: PathBuf,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ProjectionStatus {
    /// The bundle was linked or copied in.
    Written,
    /// Already correct: the destination is the source, reached directly or
    /// through an aliased root. Nothing was touched.
    AlreadyPresent,
    /// Something we will not delete is in the way.
    Conflict,
    /// The projection was removed.
    Removed,
    /// Nothing was there to remove.
    Absent,
    Failed,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ProjectionOutcome {
    pub target_id: String,
    pub status: ProjectionStatus,
    pub message: Option<String>,
}

impl ProjectionOutcome {
    fn new(target_id: &str, status: ProjectionStatus, message: Option<String>) -> Self {
        Self {
            target_id: target_id.to_string(),
            status,
            message,
        }
    }
}

/// Install `source` as `name` into every target root.
///
/// `source` is the bundle directory itself; its parent is the canonical root the
/// alias guard compares against. `project_root`, when given, is the project the
/// targets must stay inside.
pub(crate) fn project_skill(
    source: &Path,
    name: &str,
    targets: &[ProjectionTarget],
    mode: ProjectionMode,
    foreign: ForeignDirPolicy,
    project_root: Option<&Path>,
) -> Vec<ProjectionOutcome> {
    let canonical_root = source.parent().unwrap_or(source).to_path_buf();
    targets
        .iter()
        .map(|target| {
            project_one(
                source,
                &canonical_root,
                name,
                target,
                mode,
                foreign,
                project_root,
            )
        })
        .collect()
}

#[allow(clippy::too_many_arguments)]
fn project_one(
    source: &Path,
    canonical_root: &Path,
    name: &str,
    target: &ProjectionTarget,
    mode: ProjectionMode,
    foreign: ForeignDirPolicy,
    project_root: Option<&Path>,
) -> ProjectionOutcome {
    if let Some(project_root) = project_root {
        if root_escapes_project(project_root, &target.root) {
            return ProjectionOutcome::new(
                &target.id,
                ProjectionStatus::Conflict,
                Some(format!(
                    "Skills directory resolves outside the project: {}",
                    normalize_path_for_serialization(&target.root)
                )),
            );
        }
    }

    // Before anything is removed. Writing through an aliased root would delete
    // the very bundle we are installing.
    if is_alias_of_canonical_root(&target.root, canonical_root) {
        return ProjectionOutcome::new(
            &target.id,
            ProjectionStatus::AlreadyPresent,
            Some("Shares the source skills directory".into()),
        );
    }

    let dest = target.root.join(name);
    if is_same_entry(&dest, source) {
        return ProjectionOutcome::new(&target.id, ProjectionStatus::AlreadyPresent, None);
    }

    match inspect_skill_path_entry(&dest, source) {
        SkillPathEntry::Absent => {}
        // Reached the source through a symlinked parent; removing it would
        // delete the source. `is_same_entry` covers the direct case, this the
        // aliased one that survived the root guard.
        SkillPathEntry::Dir(DirIdentity::IsTarget) => {
            return ProjectionOutcome::new(&target.id, ProjectionStatus::AlreadyPresent, None);
        }
        SkillPathEntry::Dir(DirIdentity::Different) | SkillPathEntry::Other
            if foreign == ForeignDirPolicy::Refuse =>
        {
            return ProjectionOutcome::new(
                &target.id,
                ProjectionStatus::Conflict,
                Some(format!(
                    "Path already exists: {}",
                    normalize_path_for_serialization(&dest)
                )),
            );
        }
        // Every other verdict — any symlink including a dangling one, a
        // same-content copy, and (under `Replace`) a foreign directory — is
        // ours to remove and rewrite.
        _ => {
            if let Err(message) = remove_entry(&dest) {
                return ProjectionOutcome::new(&target.id, ProjectionStatus::Failed, Some(message));
            }
        }
    }

    if let Err(e) = fs::create_dir_all(&target.root) {
        return ProjectionOutcome::new(
            &target.id,
            ProjectionStatus::Failed,
            Some(format!(
                "Failed to create skills directory '{}': {e}",
                normalize_path_for_serialization(&target.root)
            )),
        );
    }

    let written = match mode {
        ProjectionMode::Symlink => create_dir_symlink(source, &dest),
        ProjectionMode::Copy => copy_dir_recursive(source, &dest).map_err(|e| {
            format!(
                "Failed to copy '{}' → '{}': {e}",
                normalize_path_for_serialization(source),
                normalize_path_for_serialization(&dest)
            )
        }),
    };

    match written {
        Ok(()) => ProjectionOutcome::new(&target.id, ProjectionStatus::Written, None),
        Err(message) => ProjectionOutcome::new(&target.id, ProjectionStatus::Failed, Some(message)),
    }
}

/// Remove `name` from every target root.
///
/// Independent per target: a provider that fails does not stop the next one, so
/// the Universal cleanup at the end of the list always runs.
pub(crate) fn reverse_project_skill(
    name: &str,
    targets: &[ProjectionTarget],
) -> Vec<ProjectionOutcome> {
    targets
        .iter()
        .map(|target| {
            let dest = target.root.join(name);
            // `lstat`, not `exists`: a dangling projection link is exactly the
            // orphan this has to clean up, and `exists` follows it and calls it
            // absent.
            if fs::symlink_metadata(&dest).is_err() {
                return ProjectionOutcome::new(&target.id, ProjectionStatus::Absent, None);
            }
            match remove_entry(&dest) {
                Ok(()) => ProjectionOutcome::new(&target.id, ProjectionStatus::Removed, None),
                Err(message) => {
                    ProjectionOutcome::new(&target.id, ProjectionStatus::Failed, Some(message))
                }
            }
        })
        .collect()
}

/// Whether a skills root is the same directory as the source's own root,
/// reached through a folder-level alias.
///
/// A root that does not resolve is not an alias; the destination-level checks
/// handle it.
fn is_alias_of_canonical_root(host_root: &Path, canonical_root: &Path) -> bool {
    match (
        fs::canonicalize(host_root),
        fs::canonicalize(canonical_root),
    ) {
        (Ok(host), Ok(canonical)) => host == canonical,
        _ => false,
    }
}

/// Whether `dest` and `source` are the same entry, before and after resolution.
fn is_same_entry(dest: &Path, source: &Path) -> bool {
    if dest == source {
        return true;
    }
    matches!(
        (fs::canonicalize(dest), fs::canonicalize(source)),
        (Ok(a), Ok(b)) if a == b
    )
}

/// True when an existing skills root resolves outside the project it belongs to
/// — a write through it would escape the tree the user picked. A root that does
/// not exist yet is fine: it gets created inside the project.
fn root_escapes_project(project_root: &Path, host_root: &Path) -> bool {
    if fs::symlink_metadata(host_root).is_err() {
        return false;
    }
    match (fs::canonicalize(project_root), fs::canonicalize(host_root)) {
        (Ok(project), Ok(host)) => !host.starts_with(&project),
        _ => true,
    }
}

/// Delete whatever is at `path`, link or directory, without following links.
fn remove_entry(path: &Path) -> Result<(), String> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(()),
        Err(e) => {
            return Err(format!(
                "Failed to inspect '{}': {e}",
                normalize_path_for_serialization(path)
            ))
        }
    };

    // A symlink to a directory is removed as a *file* on Unix; on Windows a
    // directory symlink needs `remove_dir`. `remove_dir_all` handles the latter
    // and does not recurse through the link.
    let removed = if metadata.file_type().is_symlink() {
        fs::remove_file(path).or_else(|_| fs::remove_dir_all(path))
    } else if metadata.is_dir() {
        fs::remove_dir_all(path)
    } else {
        fs::remove_file(path)
    };

    removed.map_err(|e| {
        format!(
            "Failed to remove '{}': {e}",
            normalize_path_for_serialization(path)
        )
    })
}

fn create_dir_symlink(source: &Path, target: &Path) -> Result<(), String> {
    let absolute_source = if source.is_absolute() {
        source.to_path_buf()
    } else {
        std::env::current_dir()
            .map_err(|e| format!("Failed to resolve current directory: {e}"))?
            .join(source)
    };

    let result = {
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(&absolute_source, target)
        }
        #[cfg(windows)]
        {
            std::os::windows::fs::symlink_dir(&absolute_source, target)
        }
        #[cfg(not(any(unix, windows)))]
        {
            Err::<(), std::io::Error>(std::io::Error::new(
                std::io::ErrorKind::Unsupported,
                "Directory symlinks are not supported on this platform",
            ))
        }
    };

    result.map_err(|e| {
        format!(
            "Failed to create symlink '{}' → '{}': {e}",
            normalize_path_for_serialization(target),
            normalize_path_for_serialization(&absolute_source)
        )
    })
}

/// Copy a bundle so it stands alone.
///
/// Nested symlinks are dereferenced: a copy that quietly tracked the source
/// would defeat the only reason to choose copy mode.
fn copy_dir_recursive(source: &Path, dest: &Path) -> Result<(), std::io::Error> {
    fs::create_dir_all(dest)?;
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        let from = entry.path();
        let to = dest.join(entry.file_name());
        if fs::metadata(&from)?.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else {
            fs::copy(&from, &to)?;
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[cfg(unix)]
    use std::os::unix::fs::symlink;
    #[cfg(windows)]
    use std::os::windows::fs::symlink_dir as symlink;

    fn temp_root(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "skilltopia-projection-{label}-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_bundle(dir: &Path, description: &str) {
        fs::create_dir_all(dir.join("reference")).unwrap();
        fs::write(
            dir.join("SKILL.md"),
            format!("---\nname: demo\ndescription: {description}\n---\n\n# demo\n"),
        )
        .unwrap();
        fs::write(dir.join("reference/notes.md"), "notes\n").unwrap();
    }

    fn target(id: &str, root: &Path) -> ProjectionTarget {
        ProjectionTarget {
            id: id.to_string(),
            root: root.to_path_buf(),
        }
    }

    fn link_mode(
        source: &Path,
        targets: &[ProjectionTarget],
        foreign: ForeignDirPolicy,
    ) -> Vec<ProjectionOutcome> {
        project_skill(
            source,
            "demo",
            targets,
            ProjectionMode::Symlink,
            foreign,
            None,
        )
    }

    #[test]
    fn links_into_an_empty_root() {
        let root = temp_root("empty");
        let source = root.join(".agents/skills/demo");
        write_bundle(&source, "Source");
        let host = root.join(".codex/skills");

        let outcomes = link_mode(&source, &[target("codex", &host)], ForeignDirPolicy::Refuse);

        assert_eq!(outcomes[0].status, ProjectionStatus::Written);
        assert!(host.join("demo/SKILL.md").is_file());
    }

    /// The bug the `exists`-style check produced: an orphan link blocked every
    /// later install with no repair path.
    #[test]
    #[cfg(any(unix, windows))]
    fn repairs_a_dangling_link_instead_of_reporting_a_conflict() {
        let root = temp_root("dangling");
        let source = root.join(".agents/skills/demo");
        write_bundle(&source, "Source");
        let vanished = root.join("vanished");
        write_bundle(&vanished, "Vanished");
        let host = root.join(".codex/skills");
        fs::create_dir_all(&host).unwrap();
        symlink(&vanished, host.join("demo")).unwrap();
        fs::remove_dir_all(&vanished).unwrap();

        let outcomes = link_mode(&source, &[target("codex", &host)], ForeignDirPolicy::Refuse);

        assert_eq!(outcomes[0].status, ProjectionStatus::Written);
        assert_eq!(fs::read_link(host.join("demo")).unwrap(), source);
    }

    #[test]
    #[cfg(any(unix, windows))]
    fn replaces_a_link_pointing_somewhere_else() {
        let root = temp_root("stale-link");
        let source = root.join(".agents/skills/demo");
        write_bundle(&source, "Source");
        let other = root.join("other");
        write_bundle(&other, "Other");
        let host = root.join(".codex/skills");
        fs::create_dir_all(&host).unwrap();
        symlink(&other, host.join("demo")).unwrap();

        let outcomes = link_mode(&source, &[target("codex", &host)], ForeignDirPolicy::Refuse);

        assert_eq!(outcomes[0].status, ProjectionStatus::Written);
        assert_eq!(fs::read_link(host.join("demo")).unwrap(), source);
        assert!(other.join("SKILL.md").is_file(), "the old target survives");
    }

    #[test]
    fn refuses_a_foreign_directory_under_refuse() {
        let root = temp_root("foreign-refuse");
        let source = root.join(".agents/skills/demo");
        write_bundle(&source, "Source");
        let host = root.join(".codex/skills");
        write_bundle(&host.join("demo"), "Someone else's");

        let outcomes = link_mode(&source, &[target("codex", &host)], ForeignDirPolicy::Refuse);

        assert_eq!(outcomes[0].status, ProjectionStatus::Conflict);
        assert!(fs::read_to_string(host.join("demo/SKILL.md"))
            .unwrap()
            .contains("Someone else's"));
    }

    #[test]
    fn replaces_a_legacy_real_directory_under_replace() {
        let root = temp_root("foreign-replace");
        let source = root.join(".agents/skills/demo");
        write_bundle(&source, "Source");
        let host = root.join(".codex/skills");
        write_bundle(&host.join("demo"), "Legacy copy");

        let outcomes = link_mode(
            &source,
            &[target("codex", &host)],
            ForeignDirPolicy::Replace,
        );

        assert_eq!(outcomes[0].status, ProjectionStatus::Written);
        assert!(fs::read_to_string(host.join("demo/SKILL.md"))
            .unwrap()
            .contains("Source"));
    }

    /// The regression the ticket names: six providers declare `~/.agents/skills`
    /// outright, and any host root can be symlinked onto it. Writing through one
    /// would rm the canonical bundle and replace it with a link to its own path.
    #[test]
    #[cfg(any(unix, windows))]
    fn an_aliased_host_root_leaves_the_canonical_bundle_intact() {
        let root = temp_root("alias-root");
        let canonical_root = root.join(".agents/skills");
        let source = canonical_root.join("demo");
        write_bundle(&source, "Canonical");
        let aliased = root.join(".claude/skills");
        fs::create_dir_all(root.join(".claude")).unwrap();
        symlink(&canonical_root, &aliased).unwrap();

        let outcomes = link_mode(
            &source,
            &[target("claude-code", &aliased)],
            ForeignDirPolicy::Replace,
        );

        assert_eq!(outcomes[0].status, ProjectionStatus::AlreadyPresent);
        assert!(source.join("SKILL.md").is_file());
        assert!(source.join("reference/notes.md").is_file());
        assert!(
            !fs::symlink_metadata(&source)
                .unwrap()
                .file_type()
                .is_symlink(),
            "the canonical bundle must still be a real directory"
        );
    }

    /// The same root by declaration rather than by symlink — the `zed` /
    /// `cline` / `warp` case, and the one that has to survive a *repeat* run.
    #[test]
    fn an_identical_host_root_is_already_present_twice_over() {
        let root = temp_root("same-root");
        let canonical_root = root.join(".agents/skills");
        let source = canonical_root.join("demo");
        write_bundle(&source, "Canonical");

        for _ in 0..2 {
            let outcomes = link_mode(
                &source,
                &[target("zed", &canonical_root)],
                ForeignDirPolicy::Replace,
            );
            assert_eq!(outcomes[0].status, ProjectionStatus::AlreadyPresent);
        }
        assert!(source.join("SKILL.md").is_file());
    }

    #[test]
    fn one_failing_target_does_not_abort_the_rest() {
        let root = temp_root("independent");
        let source = root.join(".agents/skills/demo");
        write_bundle(&source, "Source");
        let blocked = root.join(".claude/skills");
        write_bundle(&blocked.join("demo"), "Someone else's");
        let open = root.join(".codex/skills");

        let outcomes = link_mode(
            &source,
            &[target("claude-code", &blocked), target("codex", &open)],
            ForeignDirPolicy::Refuse,
        );

        assert_eq!(outcomes[0].status, ProjectionStatus::Conflict);
        assert_eq!(outcomes[1].status, ProjectionStatus::Written);
        assert!(open.join("demo").exists());
    }

    #[test]
    fn copy_mode_writes_standalone_bytes() {
        let root = temp_root("copy-mode");
        let source = root.join("cache/demo");
        write_bundle(&source, "Cached");
        let host = root.join(".agents/skills");

        let outcomes = project_skill(
            &source,
            "demo",
            &[target("universal", &host)],
            ProjectionMode::Copy,
            ForeignDirPolicy::Replace,
            None,
        );

        assert_eq!(outcomes[0].status, ProjectionStatus::Written);
        let copied = host.join("demo");
        assert!(!fs::symlink_metadata(&copied)
            .unwrap()
            .file_type()
            .is_symlink());
        assert!(copied.join("reference/notes.md").is_file());

        fs::remove_dir_all(&source).unwrap();
        assert!(copied.join("SKILL.md").is_file(), "the copy stands alone");
    }

    #[test]
    #[cfg(any(unix, windows))]
    fn copy_mode_dereferences_a_symlinked_source() {
        let root = temp_root("copy-deref");
        let real = root.join("real");
        write_bundle(&real, "Real");
        let source = root.join("cache/demo");
        fs::create_dir_all(root.join("cache")).unwrap();
        symlink(&real, &source).unwrap();
        let host = root.join(".agents/skills");

        project_skill(
            &source,
            "demo",
            &[target("universal", &host)],
            ProjectionMode::Copy,
            ForeignDirPolicy::Replace,
            None,
        );

        fs::remove_dir_all(&real).unwrap();
        assert!(host.join("demo/SKILL.md").is_file());
    }

    #[test]
    #[cfg(any(unix, windows))]
    fn a_project_root_that_escapes_the_project_is_refused() {
        let root = temp_root("escape");
        let project = root.join("project");
        let source = project.join(".agents/skills/demo");
        write_bundle(&source, "Source");
        let outside = root.join("outside/skills");
        fs::create_dir_all(&outside).unwrap();
        let host = project.join(".codex/skills");
        fs::create_dir_all(project.join(".codex")).unwrap();
        symlink(&outside, &host).unwrap();

        let outcomes = project_skill(
            &source,
            "demo",
            &[target("codex", &host)],
            ProjectionMode::Symlink,
            ForeignDirPolicy::Replace,
            Some(&project),
        );

        assert_eq!(outcomes[0].status, ProjectionStatus::Conflict);
        assert!(!outside.join("demo").exists());
    }

    #[test]
    #[cfg(any(unix, windows))]
    fn uninstall_removes_a_dangling_link() {
        let root = temp_root("reverse-dangling");
        let host = root.join(".codex/skills");
        fs::create_dir_all(&host).unwrap();
        let vanished = root.join("vanished");
        write_bundle(&vanished, "Vanished");
        symlink(&vanished, host.join("demo")).unwrap();
        fs::remove_dir_all(&vanished).unwrap();

        let outcomes = reverse_project_skill("demo", &[target("codex", &host)]);

        assert_eq!(outcomes[0].status, ProjectionStatus::Removed);
        assert!(fs::symlink_metadata(host.join("demo")).is_err());
    }

    #[test]
    fn uninstall_reports_absent_without_failing() {
        let root = temp_root("reverse-absent");
        let host = root.join(".codex/skills");

        let outcomes = reverse_project_skill("demo", &[target("codex", &host)]);

        assert_eq!(outcomes[0].status, ProjectionStatus::Absent);
    }

    #[test]
    fn uninstall_removes_a_real_directory() {
        let root = temp_root("reverse-dir");
        let host = root.join(".codex/skills");
        write_bundle(&host.join("demo"), "Installed");

        let outcomes = reverse_project_skill("demo", &[target("codex", &host)]);

        assert_eq!(outcomes[0].status, ProjectionStatus::Removed);
        assert!(!host.join("demo").exists());
    }

    /// The uninstall half of the independence rule: an unwritable target must
    /// not stop the Universal cleanup that comes after it in the list.
    #[test]
    #[cfg(unix)]
    fn a_failing_target_does_not_stop_a_later_one() {
        use std::os::unix::fs::PermissionsExt;

        let root = temp_root("reverse-independent");
        let locked = root.join("locked/skills");
        write_bundle(&locked.join("demo"), "Locked");
        let universal = root.join(".agents/skills");
        write_bundle(&universal.join("demo"), "Universal");
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o500)).unwrap();

        let outcomes = reverse_project_skill(
            "demo",
            &[target("locked", &locked), target("universal", &universal)],
        );

        assert_eq!(outcomes[0].status, ProjectionStatus::Failed);
        assert_eq!(outcomes[1].status, ProjectionStatus::Removed);
        assert!(!universal.join("demo").exists());

        fs::set_permissions(&locked, fs::Permissions::from_mode(0o700)).unwrap();
    }
}
