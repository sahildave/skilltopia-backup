//! Read one Claude plugin install path: its manifest and the skills it ships.
//!
//! Read-only. The plugin cache belongs to Claude Code; we never write into it.
//!
//! Seam G of the plugin-provenance work. Nothing consumes it until the plugin
//! scan (Seam F) lands, hence the module-wide dead-code allowance.
#![allow(dead_code)]

use std::fs;
use std::path::{Path, PathBuf};

use crate::utils::platform::normalize_path_for_serialization;

use super::frontmatter::{parse_skill_md, sanitize_metadata};

/// Declared identity from `.claude-plugin/plugin.json`. Every field is optional:
/// an absent or malformed manifest degrades to `PluginManifest::default()`.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct PluginManifest {
    pub name: Option<String>,
    pub version: Option<String>,
    pub description: Option<String>,
    pub author: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PluginSkill {
    pub name: String,
    pub description: String,
    /// Skill directory, normalized for serialization.
    pub path: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PluginBundle {
    pub install_path: String,
    pub manifest: PluginManifest,
    pub skills: Vec<PluginSkill>,
}

fn non_empty_string(value: Option<&serde_json::Value>) -> Option<String> {
    let text = value?.as_str()?.trim();
    (!text.is_empty()).then(|| sanitize_metadata(text))
}

/// `author` is either a bare string or an object carrying `name`.
fn manifest_author(value: Option<&serde_json::Value>) -> Option<String> {
    match value? {
        serde_json::Value::String(_) => non_empty_string(value),
        serde_json::Value::Object(map) => non_empty_string(map.get("name")),
        _ => None,
    }
}

/// Read `<install_path>/.claude-plugin/plugin.json`. Absence or a parse failure
/// yields empty metadata, not an error.
pub fn read_plugin_manifest(install_path: &Path) -> PluginManifest {
    let path = install_path.join(".claude-plugin").join("plugin.json");
    let Ok(raw) = fs::read_to_string(&path) else {
        return PluginManifest::default();
    };
    let Ok(serde_json::Value::Object(json)) = serde_json::from_str::<serde_json::Value>(&raw)
    else {
        return PluginManifest::default();
    };
    PluginManifest {
        name: non_empty_string(json.get("name")),
        version: non_empty_string(json.get("version")),
        description: non_empty_string(json.get("description")),
        author: manifest_author(json.get("author")),
    }
}

/// Skill directories directly under `<install_path>/skills`, sorted by name.
fn skill_dirs(skills_root: &Path) -> Vec<PathBuf> {
    let Ok(entries) = fs::read_dir(skills_root) else {
        return Vec::new();
    };
    let mut dirs: Vec<PathBuf> = entries
        .flatten()
        .map(|entry| entry.path())
        .filter(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| !name.starts_with('.'))
                && fs::metadata(path).is_ok_and(|meta| meta.is_dir())
        })
        .collect();
    dirs.sort();
    dirs
}

/// Enumerate the skills a plugin ships. A directory without a readable,
/// well-formed `SKILL.md` is skipped, matching the provider scan's contract.
pub fn read_plugin_skills(install_path: &Path) -> Vec<PluginSkill> {
    skill_dirs(&install_path.join("skills"))
        .into_iter()
        .filter_map(|dir| {
            let raw = fs::read_to_string(dir.join("SKILL.md")).ok()?;
            let parsed = parse_skill_md(&raw)?;
            Some(PluginSkill {
                name: parsed.name,
                description: parsed.description,
                path: normalize_path_for_serialization(&dir),
            })
        })
        .collect()
}

/// Manifest plus shipped skills for one plugin install path. Never fails: a
/// missing plugin, an unreadable manifest and a plugin that ships no skills all
/// degrade to empty parts of the same bundle.
pub fn read_plugin_bundle(install_path: &Path) -> PluginBundle {
    PluginBundle {
        install_path: normalize_path_for_serialization(install_path),
        manifest: read_plugin_manifest(install_path),
        skills: read_plugin_skills(install_path),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_plugin(label: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "skilltopia-plugin-{label}-{}",
            SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn write_manifest(root: &Path, contents: &str) {
        let dir = root.join(".claude-plugin");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("plugin.json"), contents).unwrap();
    }

    fn write_skill(root: &Path, dir_name: &str, contents: &str) {
        let dir = root.join("skills").join(dir_name);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("SKILL.md"), contents).unwrap();
    }

    fn valid_skill_md(name: &str) -> String {
        format!("---\nname: {name}\ndescription: Does {name} things\n---\n\n# Body\n")
    }

    #[test]
    fn reads_manifest_and_shipped_skills() {
        let root = temp_plugin("happy");
        write_manifest(
            &root,
            r#"{"name":"ponytail","version":"1.2.0","description":"Laziest solution","author":{"name":"Matt"}}"#,
        );
        write_skill(&root, "ponytail", &valid_skill_md("ponytail"));
        write_skill(&root, "ponytail-audit", &valid_skill_md("ponytail-audit"));

        let bundle = read_plugin_bundle(&root);
        assert_eq!(bundle.manifest.name.as_deref(), Some("ponytail"));
        assert_eq!(bundle.manifest.version.as_deref(), Some("1.2.0"));
        assert_eq!(
            bundle.manifest.description.as_deref(),
            Some("Laziest solution")
        );
        assert_eq!(bundle.manifest.author.as_deref(), Some("Matt"));
        let names: Vec<&str> = bundle.skills.iter().map(|s| s.name.as_str()).collect();
        assert_eq!(names, vec!["ponytail", "ponytail-audit"]);
        assert_eq!(bundle.skills[0].description, "Does ponytail things");
        assert!(bundle.skills[0].path.ends_with("skills/ponytail"));
    }

    #[test]
    fn author_may_be_a_bare_string() {
        let root = temp_plugin("author-string");
        write_manifest(&root, r#"{"name":"p","author":"Sahil"}"#);
        assert_eq!(read_plugin_manifest(&root).author.as_deref(), Some("Sahil"));
    }

    #[test]
    fn plugin_without_skills_returns_empty_list() {
        let root = temp_plugin("no-skills");
        write_manifest(&root, r#"{"name":"bare"}"#);

        let bundle = read_plugin_bundle(&root);
        assert_eq!(bundle.manifest.name.as_deref(), Some("bare"));
        assert!(bundle.skills.is_empty());
    }

    #[test]
    fn missing_install_path_degrades_to_an_empty_bundle() {
        let root = temp_plugin("missing").join("does-not-exist");
        let bundle = read_plugin_bundle(&root);
        assert_eq!(bundle.manifest, PluginManifest::default());
        assert!(bundle.skills.is_empty());
    }

    #[test]
    fn malformed_manifest_degrades_but_skills_still_enumerate() {
        let root = temp_plugin("bad-manifest");
        write_manifest(&root, "{ not json");
        write_skill(&root, "alpha", &valid_skill_md("alpha"));

        let bundle = read_plugin_bundle(&root);
        assert_eq!(bundle.manifest, PluginManifest::default());
        assert_eq!(bundle.skills.len(), 1);
        assert_eq!(bundle.skills[0].name, "alpha");
    }

    #[test]
    fn non_object_manifest_degrades_to_empty_metadata() {
        let root = temp_plugin("array-manifest");
        write_manifest(&root, "[1, 2, 3]");
        assert_eq!(read_plugin_manifest(&root), PluginManifest::default());
    }

    #[test]
    fn malformed_skill_is_skipped_without_aborting_the_rest() {
        let root = temp_plugin("bad-skill");
        write_skill(&root, "alpha", &valid_skill_md("alpha"));
        write_skill(&root, "broken", "no frontmatter here\n");
        write_skill(&root, "zeta", &valid_skill_md("zeta"));
        // A skill directory with no SKILL.md at all.
        fs::create_dir_all(root.join("skills").join("empty-dir")).unwrap();
        // Hidden directories and loose files are not skill directories.
        fs::create_dir_all(root.join("skills").join(".hidden")).unwrap();
        fs::write(root.join("skills").join("README.md"), "# nope").unwrap();

        let names: Vec<String> = read_plugin_skills(&root)
            .into_iter()
            .map(|s| s.name)
            .collect();
        assert_eq!(names, vec!["alpha", "zeta"]);
    }

    #[test]
    fn performs_no_filesystem_writes() {
        let root = temp_plugin("read-only");
        write_manifest(&root, r#"{"name":"p"}"#);
        write_skill(&root, "alpha", &valid_skill_md("alpha"));
        let before = tree_snapshot(&root);

        read_plugin_bundle(&root);

        assert_eq!(tree_snapshot(&root), before);
    }

    fn tree_snapshot(root: &Path) -> Vec<String> {
        let mut out = Vec::new();
        let mut stack = vec![root.to_path_buf()];
        while let Some(dir) = stack.pop() {
            let Ok(entries) = fs::read_dir(&dir) else {
                continue;
            };
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_dir() {
                    stack.push(path.clone());
                }
                out.push(path.to_string_lossy().into_owned());
            }
        }
        out.sort();
        out
    }
}
