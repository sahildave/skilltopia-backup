//! skills.sh catalog access via a server-side proxy (or local direct token for maintainers).
//!
//! Production: Tauri calls the public Vercel proxy; OIDC stays on the server.
//! Local maintainer: set `SKILLS_SH_TOKEN` (e.g. via Infisical) to hit skills.sh directly.

use serde::{Deserialize, Serialize};
use specta::Type;

const SKILLS_API_BASE: &str = "https://skills.sh/api/v1";

/// Dev convenience public proxy base (no trailing slash). Override with `SKILLS_PROXY_BASE_URL`.
/// Forks/release builds should point at their own Vercel deploy — do not rely on a shared default.
const DEFAULT_PROXY_BASE_URL: &str = "https://skills-explorer-six.vercel.app";

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SkillsShSkill {
    pub id: String,
    pub slug: String,
    pub name: String,
    pub source: String,
    pub installs: i32,
    #[serde(rename = "sourceType")]
    pub source_type: String,
    #[serde(rename = "installUrl", default)]
    pub install_url: Option<String>,
    pub url: String,
    #[serde(rename = "isDuplicate", default)]
    pub is_duplicate: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SkillsLeaderboardResponse {
    pub data: Vec<SkillsShSkill>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SkillsSearchResponse {
    pub data: Vec<SkillsShSkill>,
    #[serde(default)]
    pub query: Option<String>,
    #[serde(rename = "searchType", default)]
    pub search_type: Option<String>,
    #[serde(default)]
    pub count: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SkillEnrichmentRequired {
    #[serde(rename = "primaryGoal")]
    pub primary_goal: String,
    pub requires: Vec<String>,
    #[serde(rename = "estimatedComplexity")]
    pub estimated_complexity: String,
    #[serde(rename = "bestFor")]
    pub best_for: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SkillEnrichment {
    #[serde(rename = "skillId")]
    pub skill_id: String,
    #[serde(rename = "contentHash")]
    pub content_hash: String,
    pub required: SkillEnrichmentRequired,
    pub optional: serde_json::Value,
    #[serde(rename = "estimatedReadTimeMinutes")]
    pub estimated_read_time_minutes: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct RelatedSkill {
    #[serde(rename = "skillId")]
    pub skill_id: String,
    pub score: f64,
    pub repository: Option<String>,
    pub source: Option<String>,
    #[serde(rename = "sourceUrl")]
    pub source_url: Option<String>,
    #[serde(rename = "installCount")]
    pub install_count: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SkillPageSnapshot {
    #[serde(default)]
    pub summary: Option<String>,
    #[serde(default)]
    pub topics: Option<Vec<String>>,
    #[serde(default)]
    pub repository: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(default)]
    pub stars: Option<i32>,
    #[serde(rename = "firstSeen", default)]
    pub first_seen: Option<String>,
    #[serde(rename = "installCommand", default)]
    pub install_command: Option<String>,
    #[serde(default)]
    pub related: Option<serde_json::Value>,
    #[serde(rename = "weeklyInstalls", default)]
    pub weekly_installs: Option<Vec<i32>>,
    #[serde(rename = "skillMdPreview", default)]
    pub skill_md_preview: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SkillDetailData {
    #[serde(rename = "skillId")]
    pub skill_id: String,
    #[serde(rename = "pageSnapshot", default)]
    pub page_snapshot: Option<SkillPageSnapshot>,
    #[serde(rename = "pageScrapedAt", default)]
    pub page_scraped_at: Option<String>,
    #[serde(default)]
    pub repository: Option<String>,
    #[serde(default)]
    pub source: Option<String>,
    #[serde(rename = "installCount", default)]
    pub install_count: Option<i32>,
    #[serde(rename = "sourceUrl", default)]
    pub source_url: Option<String>,
    #[serde(rename = "installSeries", default)]
    pub install_series: Vec<i32>,
    pub enrichment: Option<SkillEnrichment>,
    pub related: Vec<RelatedSkill>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SkillDetailResponse {
    pub data: SkillDetailData,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SkillAuditEntry {
    pub provider: String,
    pub slug: String,
    pub status: String,
    pub summary: String,
    #[serde(rename = "auditedAt")]
    pub audited_at: String,
    #[serde(rename = "riskLevel", default)]
    pub risk_level: Option<String>,
    #[serde(default)]
    pub categories: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SkillAuditsPayload {
    pub id: String,
    pub source: String,
    pub slug: String,
    pub audits: Vec<SkillAuditEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SkillAuditsData {
    #[serde(rename = "skillId")]
    pub skill_id: String,
    pub audits: Option<SkillAuditsPayload>,
    pub source: String,
    #[serde(rename = "auditsFetchedAt")]
    pub audits_fetched_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct SkillAuditsResponse {
    pub data: SkillAuditsData,
}

fn proxy_base_url() -> String {
    std::env::var("SKILLS_PROXY_BASE_URL")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .or_else(|| option_env!("SKILLS_PROXY_BASE_URL").map(str::to_string))
        .unwrap_or_else(|| DEFAULT_PROXY_BASE_URL.to_string())
        .trim_end_matches('/')
        .to_string()
}

fn direct_token() -> Option<String> {
    std::env::var("SKILLS_SH_TOKEN")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

async fn get_json<T: for<'de> Deserialize<'de>>(path_and_query: &str) -> Result<T, String> {
    let client = reqwest::Client::new();

    let (url, auth_header) = if let Some(token) = direct_token() {
        (
            format!("{SKILLS_API_BASE}{path_and_query}"),
            Some(format!("Bearer {token}")),
        )
    } else {
        (format!("{}{path_and_query}", proxy_base_url()), None)
    };

    log::debug!("skills.sh request: {url}");

    let mut request = client
        .get(&url)
        .header("Accept", "application/json")
        .timeout(std::time::Duration::from_secs(30));

    if let Some(auth) = auth_header {
        request = request.header("Authorization", auth);
    }

    let response = request.send().await.map_err(|e| {
        log::error!("skills.sh network error: {e}");
        format!("Network error: {e}")
    })?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        let message = match status.as_u16() {
            401 => "Unauthorized. The proxy OIDC token is missing or expired, or SKILLS_SH_TOKEN is invalid.".to_string(),
            404 => "Skill not found.".to_string(),
            429 => "Rate limit exceeded. Try again shortly.".to_string(),
            503 => "skills.sh is temporarily unavailable. Retry with backoff.".to_string(),
            _ => format!("API error ({status}): {body}"),
        };
        log::warn!("skills.sh HTTP {status}: {body}");
        return Err(message);
    }

    response.json::<T>().await.map_err(|e| {
        log::error!("skills.sh parse error: {e}");
        format!("Parse error: {e}")
    })
}

fn filter_duplicates(skills: Vec<SkillsShSkill>) -> Vec<SkillsShSkill> {
    skills
        .into_iter()
        .filter(|s| s.is_duplicate != Some(true))
        .collect()
}

/// Fetches the skills leaderboard (default: all-time, page 0, up to 500).
#[tauri::command]
#[specta::specta]
pub async fn fetch_skills_leaderboard(
    view: Option<String>,
    page: Option<i32>,
    per_page: Option<i32>,
) -> Result<Vec<SkillsShSkill>, String> {
    let view = view.unwrap_or_else(|| "all-time".to_string());
    let page = page.unwrap_or(0).max(0);
    let per_page = per_page.unwrap_or(500).clamp(1, 500);

    let path = if direct_token().is_some() {
        format!("/skills?view={view}&page={page}&per_page={per_page}")
    } else {
        format!("/api/skills?view={view}&page={page}&per_page={per_page}")
    };

    let response: SkillsLeaderboardResponse = get_json(&path).await?;
    Ok(filter_duplicates(response.data))
}

/// Searches skills by name/description (min 2 characters on the API).
#[tauri::command]
#[specta::specta]
pub async fn search_skills(q: String, limit: Option<i32>) -> Result<Vec<SkillsShSkill>, String> {
    let trimmed = q.trim().to_string();
    if trimmed.chars().count() < 2 {
        return Err("Search query must be at least 2 characters.".to_string());
    }

    let limit = limit.unwrap_or(50).clamp(1, 200);
    let encoded = urlencoding_encode(&trimmed);

    let path = if direct_token().is_some() {
        format!("/skills/search?q={encoded}&limit={limit}")
    } else {
        format!("/api/skills/search?q={encoded}&limit={limit}")
    };

    let response: SkillsSearchResponse = get_json(&path).await?;
    Ok(filter_duplicates(response.data))
}

/// Fetches enrichment and related skills for a catalog skill.
#[tauri::command]
#[specta::specta]
pub async fn fetch_skill_detail(skill_id: String) -> Result<SkillDetailData, String> {
    let skill_id = skill_id.trim().to_string();
    if skill_id.is_empty() {
        return Err("Skill ID must not be empty.".to_string());
    }
    let encoded = urlencoding_encode(&skill_id);
    let path = if direct_token().is_some() {
        format!("/skills/detail?skill_id={encoded}")
    } else {
        format!("/api/skills/detail?skill_id={encoded}")
    };
    let response: SkillDetailResponse = get_json(&path).await?;
    Ok(response.data)
}

/// Fetches cached or on-demand security audits for a catalog skill.
#[tauri::command]
#[specta::specta]
pub async fn fetch_skill_audits(skill_id: String) -> Result<SkillAuditsData, String> {
    let skill_id = skill_id.trim().to_string();
    if skill_id.is_empty() {
        return Err("Skill ID must not be empty.".to_string());
    }

    if direct_token().is_some() {
        // Maintainer direct path: upstream only (no Supabase cache).
        let path = format!("/skills/audit/{skill_id}");
        let payload: SkillAuditsPayload = get_json(&path).await?;
        return Ok(SkillAuditsData {
            skill_id,
            audits: Some(payload),
            source: "upstream".to_string(),
            audits_fetched_at: None,
        });
    }

    let encoded = urlencoding_encode(&skill_id);
    let path = format!("/api/skills/audit?skill_id={encoded}");
    let response: SkillAuditsResponse = get_json(&path).await?;
    Ok(response.data)
}

/// Minimal URL-encoding for query values (enough for search strings).
fn urlencoding_encode(value: &str) -> String {
    let mut out = String::with_capacity(value.len() * 3);
    for b in value.bytes() {
        match b {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(b as char);
            }
            b' ' => out.push('+'),
            _ => {
                use std::fmt::Write;
                let _ = write!(out, "%{b:02X}");
            }
        }
    }
    out
}
