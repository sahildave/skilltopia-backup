# Security review — main branch (2026-07-21)

Full-project security review of the checked-out **main** branch (runtime surfaces: Backend API `api/`, Tauri `src-tauri/`, React clients, Supabase/Qdrant/ingest, GitHub workflows). Git diff at review time was docs-only; scope was the whole codebase.

**Verdict:** No client secret leaks or cross-tenant data exposure found. Supabase RLS, query allowlists, and Rust path validation look sound. Five medium+ issues below block or expand release work.

## Findings

| Severity | Location | Finding | Remediation task |
|----------|----------|---------|------------------|
| High | `src-tauri/tauri.conf.json:64` | Auto-updater enabled with placeholder pubkey (`YOUR_UPDATER_PUBLIC_KEY_HERE`); `prepare-release.js` treats any non-empty pubkey as configured | [task-23](../tasks-todo/task-23-tauri-updater-signing.md) |
| Medium | `api/_lib/proxy.ts:6` | Public Backend is an unauthenticated OIDC amplifier (skills.sh budget, audit/search cost) | [task-27](../tasks-todo/task-27-public-backend-privacy.md) |
| Medium | `api/_lib/rate-limit.ts:24` | In-memory rate limit is per Fluid instance — effective limit can exceed 60 req/min/IP | [task-27](../tasks-todo/task-27-public-backend-privacy.md) |
| Medium | `src-tauri/src/commands/skills_sh.rs:11` | Hardcoded default Backend URL concentrates traffic on one operator’s OIDC budget | [task-27](../tasks-todo/task-27-public-backend-privacy.md) |
| Medium | `api/skills/audit.ts:8` | On-demand `/audit` refresh burns primary OIDC on cache miss / 7-day stale | [task-27](../tasks-todo/task-27-public-backend-privacy.md) |

## Release gate

**[task-26](../tasks-todo/task-26-first-github-release.md) (first GitHub Release) is blocked** until:

1. **High** resolved via task-23 (real updater pubkey + reject placeholder; or disable updater until signing is complete).
2. **Mediums** addressed via task-27 (abuse controls, no hardcoded production default for release binaries, `/audit` tuning) before public desktop downloads.

Task-23 and task-27 **are** the remediations — the report does not block those tasks; it defines their acceptance criteria.

## Areas reviewed without medium+ findings

- Supabase / raw skill storage (service role only; RLS on; `getRawSkillFiles` not on public routes)
- Query injection / SSRF (allowlists; scrape fetches only skills.sh URLs from `skillPageUrl()`)
- Client secret exposure (no Supabase/service keys in `src/`)
- Tauri filesystem validation (single-segment names; symlink delete does not follow targets)
- XSS (catalog/detail as React text; no scraped `dangerouslySetInnerHTML`)
- CSRF (public read-only GET Backend)
- Ingest GHA (scoped secrets; concurrency group; secondary OIDC)

## Priority

1. Before public desktop release: task-23 (or disable updater plugin).
2. Before scaling public Backend traffic: distributed rate limits + WAF (task-27).
3. Before OSS/binary distribution: remove or require explicit `SKILLS_PROXY_BASE_URL` at build time (task-27).
4. Ops: monitor primary OIDC 429s; tune `/audit` (task-27).
