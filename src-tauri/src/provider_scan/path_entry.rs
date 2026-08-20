//! What is sitting at a path, relative to a reference skill bundle.
//!
//! Purely factual. This module performs no filesystem mutation and takes no
//! position on what a caller should do about what it finds. `copy.rs` today
//! collapses every one of these verdicts into a single `Conflict`, which is why
//! a dangling symlink the app wrote itself blocks the copy flow forever with no
//! repair path.
//!
//! The verdicts are deliberately finer-grained than any one caller needs,
//! because callers legitimately map some of them to different outcomes:
//!
//! | on disk                      | copy/install        | reconcile              |
//! | ---------------------------- | ------------------- | ---------------------- |
//! | symlink → reference          | already installed   | keep                   |
//! | symlink → elsewhere          | foreign, replaceable| occupied (foreign)     |
//! | symlink → nothing (dangling) | ours to repair      | orphan pass owns it    |
//! | dir that IS the reference    | already installed   | same copy              |
//!
//! Those last two rows are the point: collapsing dangling into `absent` (which
//! is what an `exists`-style check does, since it follows the link, sees the
//! missing target and reports false) is how orphan links survive and then block
//! the next install. Everything here uses `lstat` semantics so the link itself
//! is what gets classified, never its target.
//!
//! Ported from `skill-path-entry.ts` in inkeep/open-knowledge (commit
//! `53dbab202cb7`).

use std::fs;
use std::path::Path;

/// How a symlink at the inspected path resolves.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SymlinkResolution {
    /// Resolves onto the reference bundle.
    Target,
    /// Resolves, but somewhere else.
    Elsewhere,
    /// Does not resolve at all.
    Dangling,
}

/// What a real directory at the inspected path is, relative to the reference.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum DirIdentity {
    /// The reference bundle itself, reached by another path — typically through
    /// a symlinked parent component.
    IsTarget,
    /// An independent directory whose contents match the reference byte for byte.
    SameContent,
    /// Anything else, including a directory whose real path cannot be read.
    Different,
}

/// What is at a path, relative to a reference skill bundle.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum SkillPathEntry {
    /// Nothing there, or unstattable.
    Absent,
    Symlink(SymlinkResolution),
    Dir(DirIdentity),
    /// Present but not a directory — a stray file. Never a bundle.
    Other,
}

/// Report what is at `path`, comparing against the `reference_dir` bundle.
///
/// `reference_dir` may be a raw path or an already-resolved real path; it is
/// canonicalized here either way, which is idempotent for the latter.
pub(crate) fn inspect_skill_path_entry(path: &Path, reference_dir: &Path) -> SkillPathEntry {
    // `symlink_metadata` is the `lstat` half of the contract: a dangling link
    // stats fine here, where `exists()` would have called it absent.
    let Ok(meta) = fs::symlink_metadata(path) else {
        return SkillPathEntry::Absent;
    };

    if meta.file_type().is_symlink() {
        return match (fs::canonicalize(path), fs::canonicalize(reference_dir)) {
            (Ok(resolved), Ok(reference)) if resolved == reference => {
                SkillPathEntry::Symlink(SymlinkResolution::Target)
            }
            (Ok(_), Ok(_)) => SkillPathEntry::Symlink(SymlinkResolution::Elsewhere),
            // An unreadable reference reads as dangling too. Neither caller can
            // act on the link in that race, and both re-check before writing.
            _ => SkillPathEntry::Symlink(SymlinkResolution::Dangling),
        };
    }

    if !meta.is_dir() {
        return SkillPathEntry::Other;
    }

    match (fs::canonicalize(path), fs::canonicalize(reference_dir)) {
        (Ok(resolved), Ok(reference)) if resolved == reference => {
            SkillPathEntry::Dir(DirIdentity::IsTarget)
        }
        // An unreadable real path on something `lstat` called a directory is a
        // broken path, not a bundle worth comparing.
        (Err(_), _) | (_, Err(_)) => SkillPathEntry::Dir(DirIdentity::Different),
        _ if dirs_have_same_content(path, reference_dir) => {
            SkillPathEntry::Dir(DirIdentity::SameContent)
        }
        _ => SkillPathEntry::Dir(DirIdentity::Different),
    }
}

/// Exact recursive comparison of two directory trees.
///
/// Skill bundles are small, so comparing bytes beats maintaining a hash: it
/// needs no dependency and cannot report a false match. Nested symlinks are
/// compared as links, never followed, so a cycle cannot recurse forever.
fn dirs_have_same_content(left: &Path, right: &Path) -> bool {
    let (Ok(mut left_names), Ok(mut right_names)) = (dir_entry_names(left), dir_entry_names(right))
    else {
        return false;
    };
    left_names.sort();
    right_names.sort();
    if left_names != right_names {
        return false;
    }

    left_names.iter().all(|name| {
        let left_child = left.join(name);
        let right_child = right.join(name);
        let (Ok(left_meta), Ok(right_meta)) = (
            fs::symlink_metadata(&left_child),
            fs::symlink_metadata(&right_child),
        ) else {
            return false;
        };

        let left_type = left_meta.file_type();
        let right_type = right_meta.file_type();
        if left_type.is_symlink() && right_type.is_symlink() {
            return match (fs::read_link(&left_child), fs::read_link(&right_child)) {
                (Ok(a), Ok(b)) => a == b,
                _ => false,
            };
        }
        if left_type.is_dir() && right_type.is_dir() {
            return dirs_have_same_content(&left_child, &right_child);
        }
        if left_type.is_file() && right_type.is_file() {
            return match (fs::read(&left_child), fs::read(&right_child)) {
                (Ok(a), Ok(b)) => a == b,
                _ => false,
            };
        }
        false
    })
}

fn dir_entry_names(dir: &Path) -> Result<Vec<std::ffi::OsString>, std::io::Error> {
    fs::read_dir(dir)?
        .map(|entry| entry.map(|e| e.file_name()))
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_root(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "skilltopia-path-entry-{label}-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// A minimal skill bundle: `SKILL.md` plus a nested file, so the recursive
    /// arm of the content comparison is exercised by every `dir` case.
    fn write_bundle(dir: &Path, description: &str) {
        fs::create_dir_all(dir.join("reference")).unwrap();
        fs::write(
            dir.join("SKILL.md"),
            format!("---\nname: demo\ndescription: {description}\n---\n\n# demo\n"),
        )
        .unwrap();
        fs::write(dir.join("reference/notes.md"), "shared notes\n").unwrap();
    }

    #[cfg(unix)]
    use std::os::unix::fs::symlink;
    #[cfg(windows)]
    use std::os::windows::fs::symlink_dir as symlink;

    #[test]
    fn missing_path_is_absent() {
        let root = temp_root("absent");
        let reference = root.join("reference-bundle");
        write_bundle(&reference, "Reference");

        assert_eq!(
            inspect_skill_path_entry(&root.join("nothing-here"), &reference),
            SkillPathEntry::Absent
        );
    }

    #[test]
    fn stray_file_is_other() {
        let root = temp_root("other");
        let reference = root.join("reference-bundle");
        write_bundle(&reference, "Reference");
        let stray = root.join("stray.txt");
        fs::write(&stray, "not a bundle").unwrap();

        assert_eq!(
            inspect_skill_path_entry(&stray, &reference),
            SkillPathEntry::Other
        );
    }

    #[test]
    #[cfg(any(unix, windows))]
    fn symlink_onto_reference_resolves_to_target() {
        let root = temp_root("symlink-target");
        let reference = root.join("reference-bundle");
        write_bundle(&reference, "Reference");
        let link = root.join("link");
        symlink(&reference, &link).unwrap();

        assert_eq!(
            inspect_skill_path_entry(&link, &reference),
            SkillPathEntry::Symlink(SymlinkResolution::Target)
        );
    }

    #[test]
    #[cfg(any(unix, windows))]
    fn symlink_onto_another_bundle_resolves_elsewhere() {
        let root = temp_root("symlink-elsewhere");
        let reference = root.join("reference-bundle");
        write_bundle(&reference, "Reference");
        let other = root.join("other-bundle");
        write_bundle(&other, "Other");
        let link = root.join("link");
        symlink(&other, &link).unwrap();

        assert_eq!(
            inspect_skill_path_entry(&link, &reference),
            SkillPathEntry::Symlink(SymlinkResolution::Elsewhere)
        );
    }

    /// The case the binary `exists`-style check gets wrong: this must never
    /// read as `Absent`, or the orphan link silently blocks the next install.
    #[test]
    #[cfg(any(unix, windows))]
    fn dangling_symlink_is_dangling_not_absent() {
        let root = temp_root("symlink-dangling");
        let reference = root.join("reference-bundle");
        write_bundle(&reference, "Reference");
        let vanished = root.join("vanished-bundle");
        write_bundle(&vanished, "Vanished");
        let link = root.join("link");
        symlink(&vanished, &link).unwrap();
        fs::remove_dir_all(&vanished).unwrap();

        assert!(!link.exists(), "the link must be the thing that dangles");
        assert_eq!(
            inspect_skill_path_entry(&link, &reference),
            SkillPathEntry::Symlink(SymlinkResolution::Dangling)
        );
    }

    /// A real directory reached through a symlinked *parent* — the path is not
    /// itself a link, so only canonicalization can tell it is the reference.
    #[test]
    #[cfg(any(unix, windows))]
    fn reference_reached_via_symlinked_parent_is_the_target() {
        let root = temp_root("dir-is-target");
        let real_parent = root.join("real-parent");
        fs::create_dir_all(&real_parent).unwrap();
        let reference = real_parent.join("demo");
        write_bundle(&reference, "Reference");

        let linked_parent = root.join("linked-parent");
        symlink(&real_parent, &linked_parent).unwrap();
        let via_link = linked_parent.join("demo");

        assert!(!fs::symlink_metadata(&via_link)
            .unwrap()
            .file_type()
            .is_symlink());
        assert_eq!(
            inspect_skill_path_entry(&via_link, &reference),
            SkillPathEntry::Dir(DirIdentity::IsTarget)
        );
    }

    #[test]
    fn independent_directory_with_matching_content_is_same_content() {
        let root = temp_root("dir-same-content");
        let reference = root.join("reference-bundle");
        let copy = root.join("copy-bundle");
        write_bundle(&reference, "Reference");
        write_bundle(&copy, "Reference");

        assert_eq!(
            inspect_skill_path_entry(&copy, &reference),
            SkillPathEntry::Dir(DirIdentity::SameContent)
        );
    }

    #[test]
    fn independent_directory_with_other_content_is_different() {
        let root = temp_root("dir-different");
        let reference = root.join("reference-bundle");
        let other = root.join("other-bundle");
        write_bundle(&reference, "Reference");
        write_bundle(&other, "Diverged");

        assert_eq!(
            inspect_skill_path_entry(&other, &reference),
            SkillPathEntry::Dir(DirIdentity::Different)
        );
    }

    /// Same top level, diverging one level down: proves the comparison recurses
    /// rather than stopping at the entry names.
    #[test]
    fn nested_difference_is_different() {
        let root = temp_root("dir-nested-diff");
        let reference = root.join("reference-bundle");
        let other = root.join("other-bundle");
        write_bundle(&reference, "Reference");
        write_bundle(&other, "Reference");
        fs::write(other.join("reference/notes.md"), "diverged notes\n").unwrap();

        assert_eq!(
            inspect_skill_path_entry(&other, &reference),
            SkillPathEntry::Dir(DirIdentity::Different)
        );
    }

    #[test]
    fn extra_nested_entry_is_different() {
        let root = temp_root("dir-extra-entry");
        let reference = root.join("reference-bundle");
        let other = root.join("other-bundle");
        write_bundle(&reference, "Reference");
        write_bundle(&other, "Reference");
        fs::write(other.join("reference/extra.md"), "extra\n").unwrap();

        assert_eq!(
            inspect_skill_path_entry(&other, &reference),
            SkillPathEntry::Dir(DirIdentity::Different)
        );
    }

    #[test]
    fn unreadable_reference_makes_a_real_directory_different() {
        let root = temp_root("dir-missing-reference");
        let other = root.join("other-bundle");
        write_bundle(&other, "Other");

        assert_eq!(
            inspect_skill_path_entry(&other, &root.join("gone")),
            SkillPathEntry::Dir(DirIdentity::Different)
        );
    }

    #[test]
    #[cfg(any(unix, windows))]
    fn inspection_mutates_nothing() {
        let root = temp_root("no-mutation");
        let reference = root.join("reference-bundle");
        write_bundle(&reference, "Reference");
        let vanished = root.join("vanished-bundle");
        write_bundle(&vanished, "Vanished");
        let link = root.join("link");
        symlink(&vanished, &link).unwrap();
        fs::remove_dir_all(&vanished).unwrap();

        let before = dir_entry_names(&root).map(|mut n| {
            n.sort();
            n
        });

        for path in [&link, &reference, &root.join("nothing-here")] {
            inspect_skill_path_entry(path, &reference);
        }

        let after = dir_entry_names(&root).map(|mut n| {
            n.sort();
            n
        });
        assert_eq!(before.unwrap(), after.unwrap());
        assert_eq!(
            fs::read_link(&link).unwrap(),
            vanished,
            "the dangling link must survive inspection untouched"
        );
        assert!(reference.join("SKILL.md").is_file());
    }
}
