//! Minimal YAML frontmatter parsing for SKILL.md (upstream-compatible).

use regex::Regex;
use serde::Deserialize;
use std::sync::LazyLock;

static FRONTMATTER_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?s)^---\r?\n(.*?)\r?\n---\r?\n?(.*)$").expect("frontmatter regex")
});

#[derive(Debug, Deserialize)]
struct SkillFrontmatter {
    name: Option<serde_yaml::Value>,
    description: Option<serde_yaml::Value>,
    metadata: Option<serde_yaml::Value>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ParsedSkillMeta {
    pub name: String,
    pub description: String,
    pub internal: bool,
}

/// Strip terminal/control noise the way upstream `sanitizeMetadata` does for display.
pub fn sanitize_metadata(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    for ch in input.chars() {
        let code = ch as u32;
        if ch == '\t' || ch == '\n' {
            out.push(' ');
            continue;
        }
        if (0x00..=0x1f).contains(&code) || code == 0x7f || (0x80..=0x9f).contains(&code) {
            continue;
        }
        if ch == '\u{001b}' {
            continue;
        }
        out.push(ch);
    }
    out.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn value_as_string(value: &serde_yaml::Value) -> Option<String> {
    match value {
        serde_yaml::Value::String(s) => Some(s.clone()),
        _ => None,
    }
}

fn is_internal(metadata: &Option<serde_yaml::Value>) -> bool {
    let Some(serde_yaml::Value::Mapping(map)) = metadata else {
        return false;
    };
    map.get(serde_yaml::Value::String("internal".into()))
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
}

/// Parse SKILL.md contents. Returns `None` when name/description are missing or not strings.
pub fn parse_skill_md(raw: &str) -> Option<ParsedSkillMeta> {
    let caps = FRONTMATTER_RE.captures(raw)?;
    let yaml = caps.get(1)?.as_str();
    let data: SkillFrontmatter = serde_yaml::from_str(yaml).ok()?;

    let name = data.name.as_ref().and_then(value_as_string)?;
    let description = data.description.as_ref().and_then(value_as_string)?;

    Some(ParsedSkillMeta {
        name: sanitize_metadata(&name),
        description: sanitize_metadata(&description),
        internal: is_internal(&data.metadata),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_valid_frontmatter() {
        let raw = "---\nname: find-skills\ndescription: Find skills\n---\n\n# Body\n";
        let parsed = parse_skill_md(raw).expect("parse");
        assert_eq!(parsed.name, "find-skills");
        assert_eq!(parsed.description, "Find skills");
        assert!(!parsed.internal);
    }

    #[test]
    fn rejects_missing_description() {
        let raw = "---\nname: only-name\n---\n";
        assert!(parse_skill_md(raw).is_none());
    }

    #[test]
    fn rejects_non_string_name() {
        let raw = "---\nname: 42\ndescription: ok\n---\n";
        assert!(parse_skill_md(raw).is_none());
    }

    #[test]
    fn detects_internal_flag() {
        let raw = "---\nname: secret\ndescription: hush\nmetadata:\n  internal: true\n---\n";
        let parsed = parse_skill_md(raw).expect("parse");
        assert!(parsed.internal);
    }

    #[test]
    fn sanitizes_control_chars() {
        assert_eq!(sanitize_metadata("a\nb\tc"), "a b c");
    }
}
