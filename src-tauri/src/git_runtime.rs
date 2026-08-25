//! Resolve a working Git executable for Finder-launched desktop builds.

use std::path::{Path, PathBuf};
use std::process::Command;

pub(crate) struct GitLookup {
    path_dirs: Vec<PathBuf>,
    system_dirs: Vec<PathBuf>,
}

impl GitLookup {
    pub(crate) fn from_environment() -> Self {
        let path_dirs = std::env::var_os("PATH")
            .map(|path| std::env::split_paths(&path).collect())
            .unwrap_or_default();
        let mut system_dirs = vec![
            PathBuf::from("/opt/homebrew/bin"),
            PathBuf::from("/usr/local/bin"),
            PathBuf::from("/usr/bin"),
            PathBuf::from("/bin"),
        ];
        for key in ["ProgramFiles", "ProgramFiles(x86)"] {
            if let Some(root) = std::env::var_os(key) {
                system_dirs.push(PathBuf::from(root).join("Git/cmd"));
            }
        }
        Self {
            path_dirs,
            system_dirs,
        }
    }
}

pub(crate) fn cached() -> Result<PathBuf, String> {
    static CACHE: std::sync::OnceLock<Result<PathBuf, String>> = std::sync::OnceLock::new();
    CACHE
        .get_or_init(|| resolve(&GitLookup::from_environment()))
        .clone()
}

fn resolve(lookup: &GitLookup) -> Result<PathBuf, String> {
    resolve_with(lookup, is_working_git)
}

fn resolve_with(lookup: &GitLookup, is_working: impl Fn(&Path) -> bool) -> Result<PathBuf, String> {
    let mut dirs = lookup.path_dirs.clone();
    dirs.extend(lookup.system_dirs.iter().cloned());
    let mut seen = std::collections::HashSet::new();
    dirs.retain(|dir| !dir.as_os_str().is_empty() && seen.insert(dir.clone()));

    for dir in dirs {
        for name in GIT_NAMES {
            let candidate = dir.join(name);
            if is_executable(&candidate) && is_working(&candidate) {
                if let Ok(absolute) = candidate.canonicalize() {
                    return Ok(absolute);
                }
            }
        }
    }

    Err(
        "git_runtime_not_found: Git is not installed or could not start. Install Git from https://git-scm.com/downloads, then reopen the app."
            .into(),
    )
}

fn is_working_git(candidate: &Path) -> bool {
    Command::new(candidate)
        .arg("--version")
        .output()
        .is_ok_and(|output| output.status.success())
}

#[cfg(windows)]
const GIT_NAMES: &[&str] = &["git.exe", "git"];
#[cfg(not(windows))]
const GIT_NAMES: &[&str] = &["git"];

fn is_executable(path: &Path) -> bool {
    let Ok(metadata) = std::fs::metadata(path) else {
        return false;
    };
    if !metadata.is_file() {
        return false;
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        metadata.permissions().mode() & 0o111 != 0
    }
    #[cfg(not(unix))]
    {
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        fs,
        path::{Path, PathBuf},
    };

    fn scratch(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "git-runtime-{label}-{}-{}",
            std::process::id(),
            std::thread::current().name().unwrap_or("test")
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("scratch dir");
        dir
    }

    fn write_git(dir: &Path) -> PathBuf {
        fs::create_dir_all(dir).expect("bin dir");
        let path = dir.join(GIT_NAMES[0]);
        fs::write(&path, "git fixture").expect("write git");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).expect("chmod");
        }
        path
    }

    #[test]
    fn finds_a_working_git_in_a_candidate_location() {
        let root = scratch("found");
        let expected = write_git(&root.join("bin")).canonicalize().unwrap();

        let actual = resolve_with(
            &GitLookup {
                path_dirs: vec![root.join("bin")],
                system_dirs: Vec::new(),
            },
            |_| true,
        )
        .expect("git should resolve");

        assert_eq!(actual, expected);
    }

    #[test]
    fn skips_a_git_launcher_that_cannot_run() {
        let root = scratch("broken");
        let broken = write_git(&root.join("broken")).canonicalize().unwrap();
        let expected = write_git(&root.join("working")).canonicalize().unwrap();

        let actual = resolve_with(
            &GitLookup {
                path_dirs: vec![root.join("broken"), root.join("working")],
                system_dirs: Vec::new(),
            },
            |candidate| candidate.canonicalize().unwrap() != broken,
        )
        .expect("working git should resolve");

        assert_eq!(actual, expected);
    }

    #[test]
    fn reports_an_actionable_error_when_git_is_unavailable() {
        let error = resolve_with(
            &GitLookup {
                path_dirs: Vec::new(),
                system_dirs: Vec::new(),
            },
            |_| false,
        )
        .unwrap_err();

        assert!(error.contains("git_runtime_not_found"));
        assert!(error.contains("Install Git"));
    }

    #[test]
    fn turns_a_relative_path_entry_into_an_absolute_executable() {
        let relative_root =
            PathBuf::from("target").join(format!("git-runtime-relative-{}", std::process::id()));
        let _ = fs::remove_dir_all(&relative_root);
        let expected = write_git(&relative_root).canonicalize().unwrap();

        let actual = resolve_with(
            &GitLookup {
                path_dirs: vec![relative_root.clone()],
                system_dirs: Vec::new(),
            },
            |_| true,
        )
        .expect("git should resolve");

        assert!(actual.is_absolute());
        assert_eq!(actual, expected);
        let _ = fs::remove_dir_all(relative_root);
    }
}
