//! Every test here runs against a bare repository on disk. Nothing reaches the
//! network, so the suite is as fast and as deterministic offline as on.

use super::*;
use std::time::Instant;

/// Run git in `cwd`, panicking with git's own stderr — fixture setup that
/// silently half-worked would produce baffling assertion failures.
fn git_at(cwd: &Path, args: &[&str]) -> String {
    let output = Command::new("git")
        .args(args)
        .current_dir(cwd)
        .env("GIT_TERMINAL_PROMPT", "0")
        .output()
        .expect("git should be installed");
    assert!(
        output.status.success(),
        "git {args:?} failed: {}",
        String::from_utf8_lossy(&output.stderr)
    );
    String::from_utf8_lossy(&output.stdout).trim().to_string()
}

fn temp_root(label: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!(
        "skilltopia-acquire-{label}-{}",
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    fs::create_dir_all(&dir).unwrap();
    dir
}

fn commit_all(work: &Path, message: &str) {
    git_at(work, &["add", "-A"]);
    git_at(
        work,
        &[
            "-c",
            "user.email=tests@skilltopia.invalid",
            "-c",
            "user.name=Skilltopia Tests",
            "commit",
            "--quiet",
            "-m",
            message,
        ],
    );
}

/// A bare repository with a `main` branch and a divergent `v2` branch, so ref
/// selection has something to select between.
fn fixture_remote(root: &Path) -> PathBuf {
    let work = root.join("work");
    fs::create_dir_all(&work).unwrap();
    git_at(&work, &["init", "--quiet", "--initial-branch", "main", "."]);
    fs::write(work.join("SKILL.md"), "---\nname: demo\n---\n\n# demo v1\n").unwrap();
    commit_all(&work, "v1");

    git_at(&work, &["checkout", "--quiet", "-b", "v2"]);
    fs::write(work.join("SKILL.md"), "---\nname: demo\n---\n\n# demo v2\n").unwrap();
    commit_all(&work, "v2");
    git_at(&work, &["checkout", "--quiet", "main"]);

    let remote = root.join("remote.git");
    git_at(
        root,
        &[
            "clone",
            "--quiet",
            "--bare",
            work.to_str().unwrap(),
            remote.to_str().unwrap(),
        ],
    );
    remote
}

fn read_skill_md(bundle: &Path) -> String {
    fs::read_to_string(bundle.join("SKILL.md")).unwrap()
}

#[test]
fn first_acquisition_records_source_ref_and_content_hash() {
    let root = temp_root("first");
    let remote = fixture_remote(&root);
    let cache = root.join("cache");

    let acquired = acquire_skill(remote.to_str().unwrap(), &cache).unwrap();

    assert!(!acquired.cache_hit);
    assert_eq!(acquired.source, remote.to_str().unwrap());
    assert_eq!(
        read_skill_md(&acquired.bundle_path),
        "---\nname: demo\n---\n\n# demo v1\n"
    );
    // The recorded ref and hash are git's own view of what was fetched.
    assert_eq!(
        acquired.git_ref,
        git_at(&acquired.bundle_path, &["rev-parse", "HEAD"])
    );
    assert_eq!(
        acquired.content_hash,
        git_at(&acquired.bundle_path, &["rev-parse", "HEAD^{tree}"])
    );
    // The bundle lives under its commit sha, not under the source name.
    assert!(acquired.bundle_path.ends_with(&acquired.git_ref));
}

#[test]
fn second_acquisition_needs_no_remote_and_is_fast() {
    let root = temp_root("cache-hit");
    let remote = fixture_remote(&root);
    let cache = root.join("cache");
    let first = acquire_skill(remote.to_str().unwrap(), &cache).unwrap();

    // Deleting the remote is how "made no network request" is proved: a second
    // acquisition that touched it could not possibly succeed.
    fs::remove_dir_all(&remote).unwrap();

    let started = Instant::now();
    let second = acquire_skill(remote.to_str().unwrap(), &cache).unwrap();
    let elapsed = started.elapsed();

    assert!(second.cache_hit);
    assert_eq!(second.git_ref, first.git_ref);
    assert_eq!(second.content_hash, first.content_hash);
    assert_eq!(second.bundle_path, first.bundle_path);
    assert!(elapsed.as_millis() < 500, "cache hit took {elapsed:?}");
}

#[test]
fn two_refs_of_one_repo_coexist() {
    let root = temp_root("two-refs");
    let remote = fixture_remote(&root);
    let cache = root.join("cache");
    let remote_url = remote.to_str().unwrap();

    let main = acquire_skill(&format!("{remote_url}#main"), &cache).unwrap();
    let v2 = acquire_skill(&format!("{remote_url}#v2"), &cache).unwrap();

    assert_ne!(main.git_ref, v2.git_ref);
    assert_ne!(main.bundle_path, v2.bundle_path);
    assert_eq!(
        read_skill_md(&main.bundle_path),
        "---\nname: demo\n---\n\n# demo v1\n"
    );
    assert_eq!(
        read_skill_md(&v2.bundle_path),
        "---\nname: demo\n---\n\n# demo v2\n"
    );
}

#[test]
fn corrupt_cache_entry_is_refetched_rather_than_returned() {
    let root = temp_root("corrupt");
    let remote = fixture_remote(&root);
    let cache = root.join("cache");
    let first = acquire_skill(remote.to_str().unwrap(), &cache).unwrap();

    // The shape a partial write leaves behind: the index still points here, and
    // the recorded hashes still look right, but the bytes on disk are not the
    // bundle any more.
    fs::write(first.bundle_path.join("SKILL.md"), "truncat").unwrap();

    let second = acquire_skill(remote.to_str().unwrap(), &cache).unwrap();

    assert!(!second.cache_hit, "damaged bundle was served from cache");
    assert_eq!(second.content_hash, first.content_hash);
    assert_eq!(
        read_skill_md(&second.bundle_path),
        "---\nname: demo\n---\n\n# demo v1\n"
    );
}

#[test]
fn a_missing_bundle_directory_is_refetched() {
    let root = temp_root("missing");
    let remote = fixture_remote(&root);
    let cache = root.join("cache");
    let first = acquire_skill(remote.to_str().unwrap(), &cache).unwrap();

    fs::remove_dir_all(&first.bundle_path).unwrap();

    let second = acquire_skill(remote.to_str().unwrap(), &cache).unwrap();
    assert!(!second.cache_hit);
    assert_eq!(second.git_ref, first.git_ref);
}

#[test]
fn a_command_executing_transport_never_reaches_git() {
    let root = temp_root("transport");
    let cache = root.join("cache");
    let marker = root.join("pwned");
    let source = format!("ext::sh -c 'touch {}'", marker.display());

    let error = acquire_skill(&source, &cache).unwrap_err();

    assert!(matches!(
        error,
        AcquireError::Source(SourceError::ForbiddenTransport(_))
    ));
    assert!(!marker.exists(), "the helper command ran");
    // Rejection happens before anything is written, so no cache is created.
    assert!(!cache.exists());
}

#[test]
fn an_unreachable_remote_leaves_nothing_cached() {
    let root = temp_root("unreachable");
    let cache = root.join("cache");

    let error = acquire_skill(root.join("no-such-repo.git").to_str().unwrap(), &cache).unwrap_err();

    assert!(matches!(error, AcquireError::Git(_)), "{error:?}");
    assert!(!cache.join("commits").exists());
    assert!(!cache.join("sources").exists());
}
