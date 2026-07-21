# Handoff: Harden skills.sh Vercel proxy

**Status:** Ready for next thread  
**Priority:** Security follow-up after Dashboard / skills.sh catalog work  
**Date:** 2026-07-19

## Goal

Harden the public Vercel proxy so open-source / shared deployments cannot be trivially abused to burn the project’s skills.sh OIDC rate limit (600 req/min per team+project).

End users must still open the Tauri app and get skills with **no token UX**. Credentials stay server-side only.

## Context (already shipped)

| Piece                | Location                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Proxy helper         | [`api/_lib/proxy.ts`](../../api/_lib/proxy.ts)                                                                         |
| Leaderboard route    | [`api/skills.ts`](../../api/skills.ts) → upstream `/api/v1/skills`                                                     |
| Search route         | [`api/skills/search.ts`](../../api/skills/search.ts) → upstream `/api/v1/skills/search`                                |
| CORS / deploy config | [`vercel.json`](../../vercel.json) — currently `Access-Control-Allow-Origin: *`                                        |
| Tauri client         | [`src-tauri/src/commands/skills_sh.rs`](../../src-tauri/src/commands/skills_sh.rs)                                     |
| Dashboard UI         | [`src/components/skills-manager/SkillsDashboardView.tsx`](../../src/components/skills-manager/SkillsDashboardView.tsx) |
| Docs                 | [`docs/developer/external-apis.md`](../developer/external-apis.md) § skills.sh                                         |
| Env gitignore        | [`.gitignore`](../../.gitignore) — `.env`, `.env.*`, `.vercel`, etc.                                                   |

Architecture today:

```
Dashboard → TanStack Query → Rust reqwest
  → Vercel /api/skills* (@vercel/oidc)
  → https://skills.sh/api/v1/*
```

Rust clamps `per_page` (1–500) and search `limit` (1–200). The **proxy does not** — direct HTTP callers bypass clamps.

Default proxy base: `https://skilltopia-api.vercel.app` (override with `SKILLS_PROXY_BASE_URL`). Maintainer-only direct path: `SKILLS_SH_TOKEN` → call skills.sh from Rust.

## Security findings to fix

| Severity | Issue                                                                    | Where                  |
| -------- | ------------------------------------------------------------------------ | ---------------------- |
| Medium   | Unauthenticated OIDC relay + wildcard CORS                               | `vercel.json`, `api/*` |
| Medium   | Proxy forwards all query params; Rust validation bypassed on direct HTTP | `api/_lib/proxy.ts`    |

No secrets in repo. Snyk on `api/` was clean. Do **not** reintroduce keyring / user-pasted token UX.

## Recommended work (next thread)

### 1. Drop browser CORS (or restrict tightly)

Rust/Tauri bypasses CORS. Wildcard `*` only helps browser abuse.

- Prefer: **remove** `Access-Control-Allow-Origin` (and related) headers from `vercel.json`.
- Only keep CORS if a web client is intentionally in scope; then allowlist specific origins.

### 2. Allowlist + clamp query params in the proxy

In `proxySkillsRequest` (or per-route wrappers):

**Leaderboard (`/skills`):**

- Allow: `view` (`all-time` \| `trending` \| `hot`), `page` (int ≥ 0), `per_page` (int 1–500)
- Reject unknown keys with `400`

**Search (`/skills/search`):**

- Allow: `q` (string, min 2 chars), `limit` (int 1–200), optional `owner`
- Reject unknown keys with `400`

Do not forward raw `searchParams.toString()`.

### 3. Add rate limiting on the proxy

Pick one (document choice in `external-apis.md`):

- Vercel Firewall / WAF rate rules on `/api/*`, or
- Lightweight edge/KV limiter (e.g. Upstash) keyed by IP

Aim: stop drive-by scrapers from exhausting the shared OIDC quota. Perfect fairness is not required for v1.

### 4. Docs + default URL policy

Update `docs/developer/external-apis.md`:

- Proxy is a **credential amplifier** — each distributor should deploy their own Vercel project + OIDC Federation and set `SKILLS_PROXY_BASE_URL`.
- Note CORS removal and param allowlisting.
- Optionally soften or remove the hardcoded shared default URL in `skills_sh.rs` for release builds (require env), while keeping a documented default for local/dev.

### 5. Verify

- Manual: `GET /api/skills?per_page=5` still works; `?per_page=9999` → 400; unknown params → 400
- Manual: search min length / limit clamp
- Confirm Tauri Dashboard still loads (no CORS needed)
- `npm run check:all` (ignore pre-existing prettier noise in unrelated files if still present)
- `graphify update .` after code edits

## Explicit non-goals

- User-facing token paste / OS keyring for skills.sh
- Baking Infisical / OIDC into the desktop binary
- Frontend `VITE_*` tokens calling skills.sh
- Full auth product (user accounts) unless explicitly requested

## Paste into next thread

```text
Handoff: docs/tasks-todo/task-1-harden-skills-sh-proxy.md

Harden the Vercel skills.sh proxy (CORS, query allowlist/clamps, rate limit).
Do not add user token UX. Keep OIDC server-side. Follow the handoff file.
Use graphify before exploring. npm only. After code changes: graphify update .
```
