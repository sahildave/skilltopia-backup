# External APIs

Patterns for calling HTTP APIs from this app’s **two clients** (Tauri desktop and browser web) and from the **Backend API**.

> **Dual client:** Web and desktop share UI but reach the Backend differently. See [web-and-desktop.md](./web-and-desktop.md). Do not add CORS on `/api/*`.

## Who talks to what

| Caller                         | Path to Backend API                                                         | CORS?               |
| ------------------------------ | --------------------------------------------------------------------------- | ------------------- |
| **Web** (browser)              | Same-origin relative `/api/…` (prod: one Vercel project; dev: Vite proxy)   | N/A — same origin   |
| **Desktop** (Tauri WebView)    | React → CatalogPort → Tauri command → Rust `reqwest` → absolute Backend URL | N/A — Rust outbound |
| **Backend** (`api/` on Vercel) | OIDC / secrets → skills.sh, Supabase, Qdrant                                | Server-side         |

**Hard rules**

- **No browser CORS** headers on `/api/*`. Same-origin web only. Wildcard CORS would amplify abuse of the OIDC-backed proxy.
- **Desktop catalog** must not `fetch(https://deploy/api/…)` from React — that hits CORS and bypasses CatalogPort. Use Tauri commands.
- **Web catalog** must use relative `/api`, never a hardcoded absolute Backend URL in the browser (dev: Vite `server.proxy['/api']`).
- **Secrets** stay on the Backend (Infisical `dev`/`prod`). Never `VITE_*` or the Tauri binary. See [infisical.md](./infisical.md).

## Rust vs Frontend: When to Use Which

| Approach                                    | Pros                                 | Cons / when not                                             |
| ------------------------------------------- | ------------------------------------ | ----------------------------------------------------------- |
| Rust `reqwest` (desktop CatalogPort)        | No CORS, secrets stay out of WebView | Desktop path only                                           |
| Browser `fetch('/api/…')` (web CatalogPort) | Same-origin; no client secrets       | Web path only; never absolute Backend URL                   |
| Frontend `fetch` to third-party hosts       | Familiar                             | CORS + exposed keys — avoid for skills.sh / Backend secrets |

### Use Rust `reqwest` For (desktop CatalogPort)

- Catalog and any authenticated or secret-bearing calls from the desktop app
- Calls that need local caching to SQLite / device storage

### Use browser `fetch` For (web CatalogPort)

- Catalog via CatalogPort → relative `/api/…` only
- Public third-party SDKs that require browser context (not our Backend secrets)

Shared UI must not choose the transport — import `@catalog` / `@platform` only ([web-and-desktop.md](./web-and-desktop.md)).

## skills.sh (Dashboard catalog)

Official docs: [skills.sh API Reference](https://www.skills.sh/docs/api)

The Dashboard tab loads the public skills catalog through the **Backend API** (`api/` on Vercel). End users never paste tokens. The Vercel project holds OIDC; clients never hold skills.sh credentials.

```
Web:     React → CatalogPort → fetch('/api/skills*')     → Backend (same origin)
Desktop: React → CatalogPort → Tauri → reqwest            → Backend (absolute URL)
Backend: /api/skills* (OIDC via @vercel/oidc)             → https://skills.sh/api/v1/*
```

### Endpoints used

| App use                 | Proxy route                                         | Upstream                                   |
| ----------------------- | --------------------------------------------------- | ------------------------------------------ |
| Default grid (top 500)  | `GET /api/skills?view=all-time&page=0&per_page=500` | `GET /api/v1/skills`                       |
| Hybrid debounced search | `GET /api/skills/search?q=…&limit=50`               | Keyword skills.sh + Qdrant semantic search |

Upstream auth: `Authorization: Bearer <Vercel OIDC token>`. Upstream rate limit: 600 requests/minute per (team, project). Errors: `400`, `401`, `404`, `429`, `503` (see upstream docs).

### Open-source security model

The proxy is a **credential amplifier**: anyone who can hit your deployment URL shares your project’s OIDC quota. Each distributor should deploy their own Vercel project + OIDC Federation and set `SKILLS_PROXY_BASE_URL` to that deployment — do not rely on a shared public default in production forks.

- **Do not** ship Infisical secrets, OIDC tokens, or `VITE_*` API keys in the desktop binary or web bundle.
- **Do not** add browser CORS on `/api/*` (web is same-origin; Tauri/Rust bypasses CORS; wildcard CORS only helps browser abuse).
- **Do** deploy static web + `api/` on **one** Vercel project (same-origin `/api/*`), enable **OIDC Federation**, and point desktop Rust at that deployment URL.
- Proxy hardening (in `api/`):
  - **Query allowlist** — `/api/skills` allows only `view` (`all-time` \| `trending` \| `hot`), `page` (≥ 0), `per_page` (1–500). `/api/skills/search` allows only `q` (min 2 chars), `limit` (1–200), optional `owner`. Unknown keys → `400`.
  - **In-memory IP rate limit** — fixed window, 60 req/min per client IP (`x-forwarded-for` / `x-real-ip`). Best-effort across Fluid Compute instances; not a substitute for Vercel Firewall/WAF rules on `/api/*` if you need harder abuse protection.
- Proxy base URL resolution (Rust):
  1. Runtime env `SKILLS_PROXY_BASE_URL` (highest priority)
  2. Compile-time `SKILLS_PROXY_BASE_URL` if set when building
  3. Default `https://skills-explorer-six.vercel.app` (this project’s Vercel deploy). Override with `SKILLS_PROXY_BASE_URL` for forks or local `vercel dev`

### Deploy (same-origin web + Backend API)

One Vercel project serves the Vite web app (`dist/`) and `api/` together so the browser can call relative `/api/*` with no CORS.

1. Link and deploy this repo with Vercel (`vercel` / Git integration). `vercel.json` runs `npm run build:web` → `dist/`, SPA-rewrites to `/index.html`, keeps `api/` as serverless routes, and does **not** set CORS headers on `/api/*`.
2. In the Vercel project: **Settings → OIDC Federation → On**.
3. Confirm against this project’s deploy (or your fork’s URL):
   - Open the deploy root in a browser (static web shell loads)
   - `GET https://skills-explorer-six.vercel.app/api/skills?per_page=5` (same origin as the web app)
   - `GET https://skills-explorer-six.vercel.app/api/skills?per_page=9999` → `400`
   - `GET https://skills-explorer-six.vercel.app/api/skills/search?q=react&limit=5`
   - Unknown query keys → `400`
4. Desktop is unchanged: Rust still calls the absolute deploy URL via `SKILLS_PROXY_BASE_URL` (Infisical `local`) or the runtime default `https://skills-explorer-six.vercel.app`. See [infisical.md](./infisical.md).
5. Never put Backend secrets in `VITE_*` / the web bundle / the Tauri binary.

`vercel.json` `devCommand` remains the API-only placeholder so `vercel dev` does not start Vite (Chrome / Tauri own the UI ports).

### Local-first development

Dual-client script matrix (`dev:web`, `dev:mock`, `dev:all`, TARGET) lives in [web-and-desktop.md](./web-and-desktop.md). Below: **desktop + Backend** paths that work today.

Secrets and config come from **Infisical** (see [infisical.md](./infisical.md)): Backend keys in `dev` / `prod`, desktop-safe keys in `local`.

**1. Tauri local + Backend API (deployed)** — desktop day-to-day (`npm run dev:local`):

```bash
npm run dev:local
# same as: npm run tauri:dev
```

Uses Infisical `SKILLS_PROXY_BASE_URL` when set; otherwise the Rust default `https://skills-explorer-six.vercel.app`.

**2. Both local** (optional — desktop + Backend API on your machine; **not** part of `dev:all`):

```bash
npm run dev:local:proxy
# or split terminals:
#   npm run proxy:dev          # Backend API :3000 (Infisical dev + VERCEL_TELEMETRY_DISABLED)
#   npm run tauri:dev:local    # Tauri → http://127.0.0.1:3000
```

Requires the Vercel CLI (`npx vercel`) and a linked project with OIDC Federation enabled. Production `vercel.json` builds the web SPA (`build:web` → `dist/`) alongside `api/`; `devCommand` stays API-only so `vercel dev` does not start Vite (Tauri already owns `:1420`). On some macOS hosts, `vercel dev` fails to spawn the `@vercel/node` builder (`spawn EBADF` → `NO_RESPONSE_FROM_FUNCTION`); use path 1 when that happens.

### Local maintainer path

For local development **without** the Backend API, store a short-lived OIDC token as `SKILLS_SH_TOKEN` in Infisical `local`. When that env var is set, Rust calls `https://skills.sh` directly (maintainer path only — not for end users). Prefer the deployed Backend path above when possible.

Never commit Infisical exports or checked-in `.env` files.

### Frontend hooks

- Service: `src/services/skills-sh.ts` (`useSkillsLeaderboard`, `useSkillsSearch`) — will call `@catalog` after task-2
- Desktop commands today: `fetch_skills_leaderboard`, `search_skills` (tauri-specta)
- Duplicate skills (`isDuplicate: true`) are filtered out in Rust before reaching the UI (desktop path)

The search route returns one ranked list: keyword matches precede semantic-only
matches, duplicate IDs are removed, and exact/high-install matches receive a
small ranking boost. If Qdrant or Supabase is unavailable, the route returns
the keyword response with its normal result limit.

## Setup

```bash
# Already in this project — shown for new apps:
cd src-tauri && cargo add reqwest --features json,rustls
```

For secure token storage on the **device** (user-owned secrets, not skills.sh), see the Authentication section below.

## Architecture Pattern

TanStack Query at the UI; transport behind **CatalogPort** (build-time adapter).

```
React → TanStack Query → @catalog (CatalogPort)
  web:     fetch('/api/…')
  desktop: Tauri command (reqwest) → Backend URL
```

### Rust Command

```rust
use reqwest;
use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct User {
    pub id: u32,
    pub name: String,
    pub email: String,
}

#[tauri::command]
#[specta::specta]
pub async fn fetch_user(user_id: u32) -> Result<User, String> {
    let client = reqwest::Client::new();

    let response = client
        .get(format!("https://api.example.com/users/{user_id}"))
        .timeout(std::time::Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| format!("Network error: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("API error: {}", response.status()));
    }

    response.json::<User>()
        .await
        .map_err(|e| format!("Parse error: {e}"))
}
```

### React Service

```typescript
// src/services/users.ts
export const userQueryKeys = {
  all: ['users'] as const,
  user: (id: number) => [...userQueryKeys.all, id] as const,
}

export function useUser(userId: number) {
  return useQuery({
    queryKey: userQueryKeys.user(userId),
    queryFn: async () => unwrapResult(await commands.fetchUser(userId)),
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  })
}

export function useUpdateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      userId,
      data,
    }: {
      userId: number
      data: Partial<User>
    }) => {
      const result = await commands.updateUser(userId, data)
      if (result.status === 'error') throw new Error(result.error)
      return result.data
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: userQueryKeys.user(userId) })
    },
  })
}
```

## Authentication

### Token Storage Options

| Option                    | Security            | Use When                          |
| ------------------------- | ------------------- | --------------------------------- |
| `keyring` crate           | High (OS keychain)  | API tokens, credentials           |
| `tauri-plugin-stronghold` | High (encrypted DB) | Multiple secrets, encryption keys |
| `tauri-plugin-store`      | Low (plain JSON)    | Non-sensitive data only           |

For OS keychain access, use the `keyring` crate directly:

```bash
cd src-tauri && cargo add keyring
```

```rust
use keyring::Entry;

#[tauri::command]
#[specta::specta]
pub fn save_auth_token(token: String) -> Result<(), String> {
    let entry = Entry::new("myapp", "auth_token")
        .map_err(|e| format!("Keyring error: {e}"))?;
    entry.set_password(&token)
        .map_err(|e| format!("Failed to save token: {e}"))
}

#[tauri::command]
#[specta::specta]
pub fn get_auth_token() -> Result<Option<String>, String> {
    let entry = Entry::new("myapp", "auth_token")
        .map_err(|e| format!("Keyring error: {e}"))?;
    match entry.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to get token: {e}")),
    }
}
```

### Authenticated Requests

```rust
#[tauri::command]
#[specta::specta]
pub async fn fetch_protected_data() -> Result<Data, String> {
    let entry = Entry::new("myapp", "auth_token")
        .map_err(|e| format!("Keyring error: {e}"))?;
    let token = entry.get_password()
        .map_err(|_| "Not authenticated")?;

    let client = reqwest::Client::new();
    client
        .get("https://api.example.com/protected")
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .map_err(|e| format!("Request failed: {e}"))?
        .json::<Data>()
        .await
        .map_err(|e| format!("Parse error: {e}"))
}
```

## Error Handling

See [error-handling.md](./error-handling.md) for complete patterns. Key points for API calls:

```typescript
// Configure retry for network errors, not validation errors
const { data } = useQuery({
  queryKey: ['api-data'],
  queryFn: fetchData,
  retry: (failureCount, error) => {
    if (error.message.includes('validation')) return false
    return failureCount < 3
  },
})
```

## Offline Handling

For apps that need to work offline, cache API responses to SQLite:

```rust
#[tauri::command]
#[specta::specta]
pub async fn fetch_with_cache(app: tauri::AppHandle, id: u32) -> Result<Data, String> {
    // Try network first
    match fetch_from_api(id).await {
        Ok(data) => {
            cache_to_db(&app, &data)?;  // Cache for offline
            Ok(data)
        }
        Err(_) => {
            // Fallback to cache on network error
            load_from_cache(&app, id)
        }
    }
}
```

See [data-persistence.md](./data-persistence.md) for SQLite setup.

## Quick Reference

| Task              | Pattern                                    |
| ----------------- | ------------------------------------------ |
| Catalog (web)     | CatalogPort → relative `/api` (no CORS)    |
| Catalog (desktop) | CatalogPort → Tauri → reqwest → Backend    |
| skills.sh         | Backend API + OIDC (see section above)     |
| Caching           | TanStack Query (frontend) or SQLite        |
| Token storage     | `keyring` crate (OS keychain)              |
| Type safety       | tauri-specta (desktop commands)            |
| Error handling    | Result types, see error-handling.md        |
| Offline support   | Cache to SQLite, fallback on network err   |
| Dual-client rules | [web-and-desktop.md](./web-and-desktop.md) |
