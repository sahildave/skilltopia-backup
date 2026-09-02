//! Seam C: fetch a skill bundle with git, and remember that we did.
//!
//! `npx skills add` resolves the `skills` package from npm and then clones the
//! source repository on *every* install. Measured on this machine, re-installing
//! a skill already sitting on disk costs 2228 ms against 2435 ms for a fresh one
//! — there is nothing local to hit. This module is the fetch half of that,
//! moved in-process: a shallow clone into a content-addressed cache, with the
//! second acquisition of an unchanged source answered from disk.
//!
//! Three fields are recorded per source, mirroring open-knowledge's
//! `skills-lock.json`:
//!
//! - `source` — the raw reference the user imported from
//! - `ref` — the resolved commit sha
//! - `contentHash` — a hash over the fetched bundle, the dedupe key
//!
//! `contentHash` is git's own tree object id for the checked-out commit. Git
//! already hashes every byte it stores, so asking it for that hash is both
//! cheaper and harder to get wrong than walking the tree ourselves — and it
//! needs no hashing dependency.
//!
//! ## Scope boundary
//!
//! This acquires and caches. It returns a path; it does not write into provider
//! directories and does not link. That is Seam D.
//!
//! Ported from `acquire/fetch.ts` and `acquire/lockfile.ts` in
//! inkeep/open-knowledge (commit `53dbab202cb7`).

mod source;

use std::fs;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use crate::git_runtime;
pub(crate) use source::SourceError;
use source::{parse_skill_source, SkillSource};

/// A skill bundle materialised in the cache.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct AcquiredSkill {
    /// The raw reference the caller asked for.
    pub source: String,
    /// The resolved commit sha.
    pub git_ref: String,
    /// Hash over the fetched bundle — git's tree id for that commit.
    pub content_hash: String,
    /// Where the bundle now is. Owned by the cache; callers read, never write.
    pub bundle_path: PathBuf,
    /// Answered from disk, with no network traffic.
    pub cache_hit: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum AcquireError {
    Source(SourceError),
    GitUnavailable(String),
    /// A git invocation failed; carries git's own stderr.
    Git(String),
    Io(String),
}

impl std::fmt::Display for AcquireError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Source(err) => write!(f, "{err}"),
            Self::GitUnavailable(message) => write!(f, "{message}"),
            Self::Git(message) => write!(f, "git failed: {message}"),
            Self::Io(message) => write!(f, "cache is unusable: {message}"),
        }
    }
}

impl From<SourceError> for AcquireError {
    fn from(err: SourceError) -> Self {
        Self::Source(err)
    }
}

/// What the cache index remembers about one source. Field names match
/// `skills-lock.json` so the two records stay readable side by side.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CacheEntry {
    source: String,
    #[serde(rename = "ref")]
    git_ref: String,
    content_hash: String,
}

/// Fetch `raw_source` into `cache_root`, or return the copy already there.
///
/// A cache hit is decided entirely from local state: an already-acquired source
/// is not re-resolved against the remote, so the second call makes no network
/// request. Callers that want to move to a newer upstream commit ask for a
/// different ref, which lands beside the old one rather than replacing it.
pub(crate) fn acquire_skill(
    raw_source: &str,
    cache_root: &Path,
) -> Result<AcquiredSkill, AcquireError> {
    let source = parse_skill_source(raw_source)?;

    if let Some(entry) = load_valid_entry(cache_root, &source.raw) {
        return Ok(AcquiredSkill {
            bundle_path: commit_dir(cache_root, &entry.git_ref),
            source: entry.source,
            git_ref: entry.git_ref,
            content_hash: entry.content_hash,
            cache_hit: true,
        });
    }

    let staged = clone_shallow(cache_root, &source)?;
    let git_ref = git(&["rev-parse", "HEAD"], Some(&staged))?;
    let content_hash = git(&["rev-parse", "HEAD^{tree}"], Some(&staged))?;

    let bundle_path = install_staged(cache_root, &staged, &git_ref)?;
    let entry = CacheEntry {
        source: source.raw.clone(),
        git_ref,
        content_hash,
    };
    write_entry(cache_root, &source.raw, &entry)?;

    Ok(AcquiredSkill {
        source: entry.source,
        git_ref: entry.git_ref,
        content_hash: entry.content_hash,
        bundle_path,
        cache_hit: false,
    })
}

/// The recorded entry for `raw_source`, but only if its bundle directory exists.
///
/// The index and bundle are installed with atomic renames. Install validates the
/// selected skill before copying it into a provider directory.
fn load_valid_entry(cache_root: &Path, raw_source: &str) -> Option<CacheEntry> {
    let index_path = index_path(cache_root, raw_source);
    let entry: CacheEntry = serde_json::from_slice(&fs::read(&index_path).ok()?).ok()?;

    let bundle = commit_dir(cache_root, &entry.git_ref);
    if bundle.is_dir() {
        return Some(entry);
    }

    let _ = fs::remove_dir_all(&bundle);
    let _ = fs::remove_file(&index_path);
    None
}

/// Shallow-fetch `source` into a staging directory inside the cache.
///
/// `init` + `fetch --depth 1` rather than `git clone --branch`, because it is
/// one code path for every kind of ref: the default branch, a branch, a tag and
/// a commit sha all fetch the same way, where `--branch` rejects a sha.
fn clone_shallow(cache_root: &Path, source: &SkillSource) -> Result<PathBuf, AcquireError> {
    let staging = cache_root.join("staging").join(unique_name());
    fs::create_dir_all(&staging).map_err(|e| AcquireError::Io(e.to_string()))?;

    let fetch_ref = source.git_ref.as_deref().unwrap_or("HEAD");
    let result = (|| {
        git(&["init", "--quiet", "."], Some(&staging))?;
        git(&["remote", "add", "origin", &source.url], Some(&staging))?;
        git(
            &[
                // Belt and braces behind the transport allowlist: even if a URL
                // slipped past parsing, git will not run a helper for it.
                "-c",
                "protocol.ext.allow=never",
                "-c",
                "protocol.fd.allow=never",
                "fetch",
                "--quiet",
                "--depth",
                "1",
                "origin",
                fetch_ref,
            ],
            Some(&staging),
        )?;
        // Detached at FETCH_HEAD: the cache stores commits, never branches.
        git(&["checkout", "--quiet", "FETCH_HEAD"], Some(&staging))
    })();

    if let Err(err) = result {
        let _ = fs::remove_dir_all(&staging);
        return Err(err);
    }
    Ok(staging)
}

/// Move a staged checkout to its permanent, sha-keyed home.
///
/// The rename is the atomic step: a bundle only ever appears at its final path
/// complete, so a crash mid-fetch leaves rubbish in `staging/` and nothing a
/// later lookup can mistake for a finished entry.
fn install_staged(
    cache_root: &Path,
    staged: &Path,
    git_ref: &str,
) -> Result<PathBuf, AcquireError> {
    let destination = commit_dir(cache_root, git_ref);

    // Another ref of the same repo may have resolved to this same commit.
    if destination.is_dir() {
        let _ = fs::remove_dir_all(staged);
        return Ok(destination);
    }

    let _ = fs::remove_dir_all(&destination);
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent).map_err(|e| AcquireError::Io(e.to_string()))?;
    }
    fs::rename(staged, &destination).map_err(|e| AcquireError::Io(e.to_string()))?;
    Ok(destination)
}

fn write_entry(
    cache_root: &Path,
    raw_source: &str,
    entry: &CacheEntry,
) -> Result<(), AcquireError> {
    let path = index_path(cache_root, raw_source);
    let parent = path
        .parent()
        .ok_or_else(|| AcquireError::Io(format!("no parent for {}", path.display())))?;
    fs::create_dir_all(parent).map_err(|e| AcquireError::Io(e.to_string()))?;

    let serialized =
        serde_json::to_vec_pretty(entry).map_err(|e| AcquireError::Io(e.to_string()))?;
    let temp = parent.join(unique_name());
    fs::write(&temp, serialized).map_err(|e| AcquireError::Io(e.to_string()))?;
    fs::rename(&temp, &path).map_err(|e| AcquireError::Io(e.to_string()))
}

fn commit_dir(cache_root: &Path, git_ref: &str) -> PathBuf {
    cache_root.join("commits").join(git_ref)
}

fn index_path(cache_root: &Path, raw_source: &str) -> PathBuf {
    cache_root
        .join("sources")
        .join(format!("{}.json", encode_file_name(raw_source)))
}

/// Percent-encode everything outside a safe filename alphabet.
///
/// Injective, so two sources cannot collide onto one index file — which a
/// lossy "replace punctuation with a dash" scheme would allow, and which would
/// hand a caller someone else's bundle.
fn encode_file_name(raw: &str) -> String {
    raw.bytes()
        .map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'.' | b'_' | b'-' => {
                (byte as char).to_string()
            }
            _ => format!("%{byte:02X}"),
        })
        .collect()
}

fn unique_name() -> String {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or_default();
    format!("tmp-{}-{nanos}", std::process::id())
}

/// Run git, trimmed stdout on success.
///
/// `GIT_TERMINAL_PROMPT=0` matters for a desktop app: without it a private or
/// mistyped repository blocks on a credential prompt that has no terminal to
/// appear on, and the acquisition hangs instead of failing.
fn git(args: &[&str], cwd: Option<&Path>) -> Result<String, AcquireError> {
    let executable = git_runtime::cached().map_err(AcquireError::GitUnavailable)?;
    let mut command = std::process::Command::new(executable);
    command.args(args).env("GIT_TERMINAL_PROMPT", "0");
    if let Some(cwd) = cwd {
        command.current_dir(cwd);
    }

    let output = command
        .output()
        .map_err(|e| AcquireError::Git(format!("could not run git: {e}")))?;
    if !output.status.success() {
        return Err(AcquireError::Git(
            String::from_utf8_lossy(&output.stderr).trim().to_string(),
        ));
    }
    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}

#[cfg(test)]
mod tests;
