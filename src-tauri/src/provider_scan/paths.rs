//! Registry JSON types and path / detection evaluation.

use serde::Deserialize;
use std::collections::HashMap;
use std::path::{Path, PathBuf};

pub const REGISTRY_JSON: &str = include_str!("../../../src/providers/registry.json");

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistryFile {
    pub source: RegistrySource,
    pub providers: Vec<ProviderDefinition>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegistrySource {
    pub repository_url: String,
    pub commit: String,
    pub license: String,
    pub attribution: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderDefinition {
    pub id: String,
    pub display_name: String,
    #[allow(dead_code)] // Needed for serde parity with registry.json
    pub skills_dir: String,
    pub universal: bool,
    pub global_skills_dir: GlobalSkillsDir,
    pub detection: DetectionRule,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum GlobalSkillsDir {
    #[serde(rename = "path")]
    Path { path: PathSpec },
    #[serde(rename = "none")]
    None,
    #[serde(rename = "special")]
    Special { name: String },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum DetectionRule {
    #[serde(rename = "paths")]
    Paths {
        #[serde(rename = "match")]
        match_mode: String,
        paths: Vec<PathSpec>,
    },
    #[serde(rename = "never")]
    Never,
    #[serde(rename = "special")]
    Special { name: String },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "base", rename_all = "camelCase")]
pub enum PathSpec {
    #[serde(rename = "home")]
    Home { path: String },
    #[serde(rename = "configHome")]
    ConfigHome { path: String },
    #[serde(rename = "cwd")]
    Cwd { path: String },
    #[serde(rename = "absolute")]
    Absolute {
        path: String,
        #[serde(default)]
        platforms: Option<Vec<String>>,
    },
    #[serde(rename = "envHome")]
    EnvHome {
        env: String,
        #[serde(rename = "defaultPath")]
        default_path: String,
        #[serde(default)]
        path: Option<String>,
    },
    #[serde(rename = "env")]
    Env {
        env: String,
        path: String,
        #[serde(default)]
        #[allow(dead_code)] // Present in registry.json for env probes
        optional: Option<bool>,
        #[serde(default)]
        platforms: Option<Vec<String>>,
    },
}

#[derive(Debug, Clone)]
pub struct ProbeContext {
    pub home: PathBuf,
    pub cwd: PathBuf,
    /// Registry platform id: `darwin` | `win32` | `linux`
    pub platform: String,
    pub env: HashMap<String, String>,
}

impl ProbeContext {
    pub fn path_exists(&self, path: &Path) -> bool {
        path.exists()
    }

    pub fn read_file(&self, path: &Path) -> Option<String> {
        std::fs::read_to_string(path).ok()
    }
}

pub fn load_registry() -> Result<RegistryFile, String> {
    serde_json::from_str(REGISTRY_JSON).map_err(|e| format!("Invalid provider registry: {e}"))
}

fn config_home(ctx: &ProbeContext) -> PathBuf {
    if let Some(xdg) = ctx.env.get("XDG_CONFIG_HOME") {
        let trimmed = xdg.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }
    ctx.home.join(".config")
}

fn env_home(ctx: &ProbeContext, env: &str, default_path: &str) -> PathBuf {
    if let Some(value) = ctx.env.get(env) {
        let trimmed = value.trim();
        if !trimmed.is_empty() {
            return PathBuf::from(trimmed);
        }
    }
    ctx.home.join(default_path)
}

fn platform_allowed(platforms: &Option<Vec<String>>, platform: &str) -> bool {
    match platforms {
        None => true,
        Some(list) => list.iter().any(|p| p == platform),
    }
}

pub fn resolve_path_spec(spec: &PathSpec, ctx: &ProbeContext) -> Option<PathBuf> {
    match spec {
        PathSpec::Home { path } => Some(ctx.home.join(path)),
        PathSpec::ConfigHome { path } => Some(config_home(ctx).join(path)),
        PathSpec::Cwd { path } => Some(ctx.cwd.join(path)),
        PathSpec::Absolute { path, platforms } => {
            if !platform_allowed(platforms, &ctx.platform) {
                return None;
            }
            Some(PathBuf::from(path))
        }
        PathSpec::EnvHome {
            env,
            default_path,
            path,
        } => {
            let root = env_home(ctx, env, default_path);
            Some(match path {
                Some(p) if !p.is_empty() => root.join(p),
                _ => root,
            })
        }
        PathSpec::Env {
            env,
            path,
            optional: _,
            platforms,
        } => {
            if !platform_allowed(platforms, &ctx.platform) {
                return None;
            }
            let value = ctx.env.get(env)?.trim();
            if value.is_empty() {
                return None;
            }
            Some(PathBuf::from(value).join(path))
        }
    }
}

fn package_json_has_dependency(
    package_json_path: &Path,
    dependency: &str,
    ctx: &ProbeContext,
) -> bool {
    let Some(raw) = ctx.read_file(package_json_path) else {
        return false;
    };
    let Ok(value) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return false;
    };
    for key in ["dependencies", "devDependencies"] {
        if value.get(key).and_then(|d| d.get(dependency)).is_some() {
            return true;
        }
    }
    false
}

pub fn resolve_openclaw_global_skills_dir(ctx: &ProbeContext) -> PathBuf {
    if ctx.path_exists(&ctx.home.join(".openclaw")) {
        return ctx.home.join(".openclaw/skills");
    }
    if ctx.path_exists(&ctx.home.join(".clawdbot")) {
        return ctx.home.join(".clawdbot/skills");
    }
    if ctx.path_exists(&ctx.home.join(".moltbot")) {
        return ctx.home.join(".moltbot/skills");
    }
    ctx.home.join(".openclaw/skills")
}

pub fn evaluate_special_probe(name: &str, ctx: &ProbeContext) -> bool {
    if name == "eve-installed" {
        let agent_dir = ctx.cwd.join("agent");
        let package_json = ctx.cwd.join("package.json");
        return ctx.path_exists(&agent_dir)
            && package_json_has_dependency(&package_json, "eve", ctx);
    }
    // openclaw-skills-dir is skills-dir only
    false
}

pub fn evaluate_detection(rule: &DetectionRule, ctx: &ProbeContext) -> bool {
    match rule {
        DetectionRule::Never => false,
        DetectionRule::Special { name } => evaluate_special_probe(name, ctx),
        DetectionRule::Paths { match_mode, paths } => {
            let results: Vec<bool> = paths
                .iter()
                .map(|spec| {
                    resolve_path_spec(spec, ctx)
                        .map(|p| ctx.path_exists(&p))
                        .unwrap_or(false)
                })
                .collect();
            if match_mode == "all" {
                results.iter().all(|&x| x)
            } else {
                results.iter().any(|&x| x)
            }
        }
    }
}

pub fn resolve_global_skills_dir(dir: &GlobalSkillsDir, ctx: &ProbeContext) -> Option<PathBuf> {
    match dir {
        GlobalSkillsDir::None => None,
        GlobalSkillsDir::Special { name } if name == "openclaw-skills-dir" => {
            Some(resolve_openclaw_global_skills_dir(ctx))
        }
        GlobalSkillsDir::Special { .. } => None,
        GlobalSkillsDir::Path { path } => resolve_path_spec(path, ctx),
    }
}

pub fn universal_skills_dir(ctx: &ProbeContext) -> PathBuf {
    ctx.home.join(".agents").join("skills")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn ctx_with_home(home: &Path) -> ProbeContext {
        ProbeContext {
            home: home.to_path_buf(),
            cwd: home.to_path_buf(),
            platform: "darwin".into(),
            env: HashMap::new(),
        }
    }

    #[test]
    fn loads_checked_in_registry() {
        let registry = load_registry().expect("registry");
        assert!(registry.providers.len() > 10);
        assert_eq!(
            registry.source.repository_url,
            "https://github.com/vercel-labs/skills"
        );
    }

    #[test]
    fn resolves_home_and_env_home_paths() {
        let tmp = tempfile_dir();
        let mut ctx = ctx_with_home(&tmp);
        let home_spec = PathSpec::Home {
            path: ".claude".into(),
        };
        assert_eq!(
            resolve_path_spec(&home_spec, &ctx).unwrap(),
            tmp.join(".claude")
        );

        ctx.env.insert(
            "CLAUDE_CONFIG_DIR".into(),
            tmp.join("custom-claude").display().to_string(),
        );
        let env_spec = PathSpec::EnvHome {
            env: "CLAUDE_CONFIG_DIR".into(),
            default_path: ".claude".into(),
            path: Some("skills".into()),
        };
        assert_eq!(
            resolve_path_spec(&env_spec, &ctx).unwrap(),
            tmp.join("custom-claude/skills")
        );
    }

    #[test]
    fn windows_absolute_path_respects_platform_filter() {
        let tmp = tempfile_dir();
        let mut ctx = ctx_with_home(&tmp);
        ctx.platform = "darwin".into();
        let spec = PathSpec::Absolute {
            path: "C:/Users/a/AppData/Roaming/Zed".into(),
            platforms: Some(vec!["win32".into()]),
        };
        assert!(resolve_path_spec(&spec, &ctx).is_none());
        ctx.platform = "win32".into();
        assert_eq!(
            resolve_path_spec(&spec, &ctx).unwrap(),
            PathBuf::from("C:/Users/a/AppData/Roaming/Zed")
        );
    }

    #[test]
    fn detects_provider_when_probe_path_exists() {
        let tmp = tempfile_dir();
        fs::create_dir_all(tmp.join(".cursor")).unwrap();
        let ctx = ctx_with_home(&tmp);
        let registry = load_registry().unwrap();
        let cursor = registry
            .providers
            .iter()
            .find(|p| p.id == "cursor")
            .expect("cursor");
        assert!(evaluate_detection(&cursor.detection, &ctx));
    }

    #[test]
    fn resolves_macos_applications_absolute_probe_on_darwin() {
        let tmp = tempfile_dir();
        let mut ctx = ctx_with_home(&tmp);
        ctx.platform = "darwin".into();
        let spec = PathSpec::Absolute {
            path: "/Applications/ZCode.app".into(),
            platforms: None,
        };
        assert_eq!(
            resolve_path_spec(&spec, &ctx).unwrap(),
            PathBuf::from("/Applications/ZCode.app")
        );
    }

    #[test]
    fn detects_zcode_via_home_dir_and_resolves_global_skills() {
        let tmp = tempfile_dir();
        fs::create_dir_all(tmp.join(".zcode")).unwrap();
        let ctx = ctx_with_home(&tmp);
        let registry = load_registry().unwrap();
        let zcode = registry
            .providers
            .iter()
            .find(|p| p.id == "zcode")
            .expect("zcode");
        assert!(evaluate_detection(&zcode.detection, &ctx));
        let skills = resolve_global_skills_dir(&zcode.global_skills_dir, &ctx).unwrap();
        assert_eq!(skills, tmp.join(".zcode/skills"));
    }

    #[test]
    fn detects_zed_via_appdata_on_windows() {
        let tmp = tempfile_dir();
        let app_data = tmp.join("AppData/Roaming");
        fs::create_dir_all(app_data.join("Zed")).unwrap();
        let mut ctx = ctx_with_home(&tmp);
        ctx.platform = "win32".into();
        ctx.env
            .insert("APPDATA".into(), app_data.display().to_string());
        let registry = load_registry().unwrap();
        let zed = registry
            .providers
            .iter()
            .find(|p| p.id == "zed")
            .expect("zed");
        assert!(evaluate_detection(&zed.detection, &ctx));
    }

    #[test]
    fn resolves_config_home_and_env_global_skills_dirs() {
        let tmp = tempfile_dir();
        let xdg = tmp.join("xdg-config");
        let mut ctx = ctx_with_home(&tmp);
        ctx.env
            .insert("XDG_CONFIG_HOME".into(), xdg.display().to_string());
        ctx.env.insert(
            "CLAUDE_CONFIG_DIR".into(),
            tmp.join("custom-claude").display().to_string(),
        );

        let registry = load_registry().unwrap();
        let amp = registry
            .providers
            .iter()
            .find(|p| p.id == "amp")
            .expect("amp");
        assert_eq!(
            resolve_global_skills_dir(&amp.global_skills_dir, &ctx).unwrap(),
            xdg.join("agents/skills")
        );

        let claude = registry
            .providers
            .iter()
            .find(|p| p.id == "claude-code")
            .expect("claude-code");
        assert_eq!(
            resolve_global_skills_dir(&claude.global_skills_dir, &ctx).unwrap(),
            tmp.join("custom-claude/skills")
        );
    }

    fn tempfile_dir() -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "skills-explorer-probe-{}",
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&dir).unwrap();
        dir
    }
}
