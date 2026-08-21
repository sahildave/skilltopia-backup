//! Absolute Node runtime discovery for spawning the skills CLI.
//!
//! A Finder-launched `.app` inherits `PATH=/usr/bin:/bin:/usr/sbin:/sbin`, so a
//! bare `npx` spawn fails with `ENOENT` before any work happens. We resolve an
//! absolute `npx` once at startup and spawn that instead.
//!
//! Resolving the binary is not enough on its own: `npx` is a `#!/usr/bin/env node`
//! shebang script, and npm re-spawns `node` for its own subprocesses. Callers must
//! also prepend [`NodeRuntime::bin_dir`] to the child's `PATH`.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

/// Where to look for a Node runtime. Injected so tests can point at a scratch tree
/// instead of picking up the developer's real install.
pub struct NodeLookup {
    pub home: PathBuf,
    /// The inherited `PATH`, already split into directories.
    pub path_dirs: Vec<PathBuf>,
    /// Absolute, non-`$HOME` install locations, in priority order.
    pub system_dirs: Vec<PathBuf>,
}

impl NodeLookup {
    pub fn from_environment() -> Self {
        let path_dirs = std::env::var_os("PATH")
            .map(|path| std::env::split_paths(&path).collect())
            .unwrap_or_default();
        Self {
            home: home_dir(),
            path_dirs,
            system_dirs: [
                "/opt/homebrew/bin", // Homebrew, Apple silicon
                "/usr/local/bin",    // Homebrew x86 + the nodejs.org installer
                "/usr/bin",
                "/bin",
            ]
            .iter()
            .map(PathBuf::from)
            .collect(),
        }
    }
}

/// An `npx` executable that exists on disk, plus the directory holding its
/// sibling `node`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NodeRuntime {
    pub npx: PathBuf,
    pub bin_dir: PathBuf,
}

impl NodeRuntime {
    /// The child `PATH` to spawn with: this runtime's bin dir first, then whatever
    /// the app inherited.
    pub fn child_path(&self, inherited: &[PathBuf]) -> std::ffi::OsString {
        let mut dirs = vec![self.bin_dir.clone()];
        dirs.extend(
            inherited
                .iter()
                .filter(|dir| *dir != &self.bin_dir)
                .cloned(),
        );
        std::env::join_paths(dirs).unwrap_or_else(|_| self.bin_dir.clone().into_os_string())
    }
}

/// Resolve `npx` once per process. Repeated calls reuse the first answer,
/// including the failure, so no spawn re-derives the path.
pub fn cached(lookup: &NodeLookup) -> Result<NodeRuntime, String> {
    static CACHE: std::sync::OnceLock<Result<NodeRuntime, String>> = std::sync::OnceLock::new();
    CACHE.get_or_init(|| resolve(lookup)).clone()
}

/// Search the inherited `PATH` first, then the well-known install locations.
pub fn resolve(lookup: &NodeLookup) -> Result<NodeRuntime, String> {
    let candidates = candidate_dirs(lookup);
    for dir in &candidates {
        for name in NPX_NAMES {
            let candidate = dir.join(name);
            if is_executable(&candidate) {
                return Ok(NodeRuntime {
                    npx: candidate,
                    bin_dir: dir.clone(),
                });
            }
        }
    }
    log::debug!(
        "No npx found. Searched: {}",
        candidates
            .iter()
            .map(|dir| dir.display().to_string())
            .collect::<Vec<_>>()
            .join(", ")
    );
    Err(format!(
        "{NODE_NOT_FOUND_CODE}: Node.js is not installed, or is installed somewhere this app \
         cannot see. Installing and uninstalling skills needs Node.js, which provides `npx`. \
         Install it from https://nodejs.org, then reopen the app."
    ))
}

#[cfg(windows)]
const NPX_NAMES: &[&str] = &["npx.cmd", "npx.exe", "npx"];
#[cfg(not(windows))]
const NPX_NAMES: &[&str] = &["npx"];

/// Directories to search, in priority order, de-duplicated.
fn candidate_dirs(lookup: &NodeLookup) -> Vec<PathBuf> {
    let home = &lookup.home;
    let mut dirs: Vec<PathBuf> = lookup.path_dirs.clone();

    // Version managers keep the newest install out of a GUI-inherited PATH.
    dirs.extend(versioned_bin_dirs(&home.join(".nvm/versions/node"), "bin"));
    dirs.extend(versioned_bin_dirs(
        &home.join(".fnm/node-versions"),
        "installation/bin",
    ));
    dirs.push(home.join(".volta/bin"));
    dirs.push(home.join(".asdf/shims"));
    dirs.push(home.join(".local/bin"));
    dirs.extend(lookup.system_dirs.iter().cloned());

    let mut seen = std::collections::HashSet::new();
    dirs.retain(|dir| !dir.as_os_str().is_empty() && seen.insert(dir.clone()));
    dirs
}

/// Expand a version-manager root (`<root>/<version>/<suffix>`), newest version first.
fn versioned_bin_dirs(root: &Path, suffix: &str) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(root) else {
        return Vec::new();
    };
    let mut versions: Vec<PathBuf> = entries
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.is_dir())
        .collect();
    versions.sort_by_key(|path| {
        std::cmp::Reverse(version_key(
            path.file_name()
                .and_then(|name| name.to_str())
                .unwrap_or(""),
        ))
    });
    versions.into_iter().map(|path| path.join(suffix)).collect()
}

/// Numeric sort key for `v22.3.1`-style directory names, so `v22` beats `v9`.
fn version_key(name: &str) -> [u64; 3] {
    let mut key = [0_u64; 3];
    for (slot, part) in key.iter_mut().zip(name.trim_start_matches('v').split('.')) {
        *slot = part
            .chars()
            .take_while(char::is_ascii_digit)
            .collect::<String>()
            .parse()
            .unwrap_or(0);
    }
    key
}

/// A file that exists and carries an execute bit. A candidate that is present but
/// not executable must not shadow a working install later in the search order.
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

/// Stable code the frontend matches to show a localized message. The English text
/// after it is for logs; the UI substitutes a translated string. It deliberately
/// avoids the words "permission" and "scope", which the frontend uses to classify
/// a different failure.
const NODE_NOT_FOUND_CODE: &str = "node_runtime_not_found";

fn home_dir() -> PathBuf {
    for key in ["HOME", "USERPROFILE"] {
        if let Ok(value) = std::env::var(key) {
            if !value.trim().is_empty() {
                return PathBuf::from(value);
            }
        }
    }
    PathBuf::from(".")
}

/// The environment overrides a skills-CLI child needs: an inherited-`PATH` prefix
/// pointing at the resolved runtime.
pub fn child_env(runtime: &NodeRuntime, lookup: &NodeLookup) -> HashMap<String, String> {
    let mut env = HashMap::new();
    env.insert(
        "PATH".to_string(),
        runtime
            .child_path(&lookup.path_dirs)
            .to_string_lossy()
            .into_owned(),
    );
    env
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn scratch(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("node-runtime-{label}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).expect("scratch dir");
        dir
    }

    fn write_npx(dir: &Path, mode: u32) -> PathBuf {
        fs::create_dir_all(dir).expect("bin dir");
        let path = dir.join("npx");
        fs::write(&path, b"#!/usr/bin/env node\n").expect("write npx");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&path, fs::Permissions::from_mode(mode)).expect("chmod");
        }
        let _ = mode;
        path
    }

    #[test]
    fn finds_npx_in_a_candidate_location() {
        let home = scratch("found");
        let bin = home.join(".nvm/versions/node/v22.3.1/bin");
        let expected = write_npx(&bin, 0o755);

        let runtime = resolve(&NodeLookup {
            home,
            path_dirs: Vec::new(),
            system_dirs: Vec::new(),
        })
        .expect("npx should resolve");

        assert_eq!(runtime.npx, expected);
        assert_eq!(runtime.bin_dir, bin);
    }

    #[test]
    fn reports_an_actionable_message_when_nothing_is_found() {
        let home = scratch("missing");

        let error = resolve(&NodeLookup {
            home,
            // An empty scratch dir stands in for the Finder-inherited PATH.
            path_dirs: vec![scratch("empty-path")],
            system_dirs: Vec::new(),
        })
        .expect_err("no npx anywhere");

        assert!(error.starts_with(NODE_NOT_FOUND_CODE), "{error}");
        assert!(error.contains("Node.js"), "{error}");
        assert!(error.contains("nodejs.org"), "{error}");
        // Must not trip the frontend's permission-error classifier.
        let lower = error.to_lowercase();
        assert!(
            !lower.contains("permission") && !lower.contains("scope"),
            "{error}"
        );
    }

    #[cfg(unix)]
    #[test]
    fn skips_a_candidate_that_exists_but_is_not_executable() {
        let home = scratch("not-exec");
        write_npx(&home.join(".volta/bin"), 0o644);
        let working = write_npx(&home.join(".local/bin"), 0o755);

        let runtime = resolve(&NodeLookup {
            home,
            path_dirs: Vec::new(),
            system_dirs: Vec::new(),
        })
        .expect("should fall through to the executable candidate");

        assert_eq!(runtime.npx, working);
    }

    /// nvm and Volta ship `npx` as a symlink to a `.js` file, so the executable
    /// check has to follow links rather than stat the link itself.
    #[cfg(unix)]
    #[test]
    fn follows_a_symlinked_npx() {
        let home = scratch("symlink");
        let real = write_npx(&home.join("lib/npm/bin"), 0o755);
        let bin = home.join(".volta/bin");
        fs::create_dir_all(&bin).expect("bin dir");
        std::os::unix::fs::symlink(&real, bin.join("npx")).expect("symlink");

        let runtime = resolve(&NodeLookup {
            home,
            path_dirs: Vec::new(),
            system_dirs: Vec::new(),
        })
        .expect("npx should resolve through the symlink");

        assert_eq!(runtime.bin_dir, bin);
    }

    #[test]
    fn newest_node_version_wins() {
        let home = scratch("versions");
        let root = home.join(".nvm/versions/node");
        write_npx(&root.join("v9.11.2/bin"), 0o755);
        let newest = write_npx(&root.join("v22.3.1/bin"), 0o755);

        let runtime = resolve(&NodeLookup {
            home,
            path_dirs: Vec::new(),
            system_dirs: Vec::new(),
        })
        .expect("npx should resolve");

        assert_eq!(runtime.npx, newest);
    }

    #[test]
    fn child_path_puts_the_resolved_bin_dir_first_without_duplicating_it() {
        let runtime = NodeRuntime {
            npx: PathBuf::from("/opt/homebrew/bin/npx"),
            bin_dir: PathBuf::from("/opt/homebrew/bin"),
        };
        let inherited = vec![
            PathBuf::from("/usr/bin"),
            PathBuf::from("/opt/homebrew/bin"),
        ];

        let path = runtime.child_path(&inherited);

        let dirs: Vec<PathBuf> = std::env::split_paths(&path).collect();
        assert_eq!(
            dirs,
            vec![
                PathBuf::from("/opt/homebrew/bin"),
                PathBuf::from("/usr/bin")
            ]
        );
    }
}
