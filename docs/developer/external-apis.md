# External APIs

Patterns for calling external HTTP APIs from Tauri applications.

> **Note:** This app uses `reqwest` (Rust) for outbound HTTP. Prefer Rust commands for production API access so credentials stay out of the WebView.

## Rust vs Frontend: When to Use Which

**Default recommendation: Use Rust backend (reqwest)**

| Approach         | Pros                                           | Cons                            |
| ---------------- | ---------------------------------------------- | ------------------------------- |
| Rust (reqwest)   | CORS bypass, secure token storage, type safety | More code per endpoint          |
| Frontend (fetch) | Less boilerplate, familiar API                 | CORS restrictions, exposed keys |

### Use Rust Backend For

- All authenticated API calls (keeps tokens out of WebView)
- APIs with CORS restrictions (desktop apps bypass CORS from Rust)
- Calls requiring response caching to local storage
- Production applications

### Use Frontend Fetch For

- Public APIs with no authentication
- Rapid prototyping before moving to Rust
- Third-party SDKs requiring browser context

## skills.sh (Dashboard catalog)

Official docs: [skills.sh API Reference](https://www.skills.sh/docs/api)

The Dashboard tab loads the public skills catalog through a **server-side Vercel proxy**. End users never paste tokens. The Vercel project holds OIDC; the desktop app only talks to your proxy.

```
React (Dashboard) → TanStack Query → Tauri command (reqwest)
  → Vercel /api/skills* (OIDC via @vercel/oidc)
  → https://skills.sh/api/v1/*
```

### Endpoints used

| App use                | Proxy route                                         | Upstream                    |
| ---------------------- | --------------------------------------------------- | --------------------------- |
| Default grid (top 500) | `GET /api/skills?view=all-time&page=0&per_page=500` | `GET /api/v1/skills`        |
| Debounced search       | `GET /api/skills/search?q=…&limit=50`               | `GET /api/v1/skills/search` |

Upstream auth: `Authorization: Bearer <Vercel OIDC token>`. Rate limit: 600 requests/minute per (team, project). Errors: `400`, `401`, `404`, `429`, `503` (see upstream docs).

### Open-source security model

- **Do not** ship Infisical secrets, OIDC tokens, or `VITE_*` API keys in the desktop binary.
- **Do** deploy `api/` on Vercel, enable **OIDC Federation** on that project, and point the app at the deployment URL.
- Proxy base URL resolution (Rust):
  1. Runtime env `SKILLS_PROXY_BASE_URL` (highest priority)
  2. Compile-time `SKILLS_PROXY_BASE_URL` if set when building
  3. Default `https://skills-explorer.vercel.app` (change after you deploy)

### Deploy the proxy

1. Link and deploy this repo’s `api/` routes with Vercel (`vercel` / Git integration). `vercel.json` is configured for an API-focused deploy.
2. In the Vercel project: **Settings → OIDC Federation → On**.
3. Confirm:
   - `GET https://<your-deployment>/api/skills?per_page=5`
   - `GET https://<your-deployment>/api/skills/search?q=react&limit=5`
4. Set `SKILLS_PROXY_BASE_URL` for local Tauri runs if the default URL is not yours:
   ```bash
   export SKILLS_PROXY_BASE_URL=https://your-deployment.vercel.app
   npm run tauri:dev
   ```

### Local maintainer / Infisical (optional)

For local development **without** `vercel dev`, inject a short-lived OIDC token as `SKILLS_SH_TOKEN`. When that env var is set, Rust calls `https://skills.sh` directly (maintainer path only — not for end users).

```bash
# Infisical (same habit as Next.js)
infisical run -- npm run tauri:dev

# Or Vercel CLI
vercel link && vercel env pull
# map VERCEL_OIDC_TOKEN → SKILLS_SH_TOKEN in your shell/Infisical
```

Never commit `.env.local` or Infisical exports.

### Frontend hooks

- Service: `src/services/skills-sh.ts` (`useSkillsLeaderboard`, `useSkillsSearch`)
- Commands: `fetch_skills_leaderboard`, `search_skills` (tauri-specta)
- Duplicate skills (`isDuplicate: true`) are filtered out in Rust before reaching the UI

## Setup

```bash
# Already in this project — shown for new apps:
cd src-tauri && cargo add reqwest --features json,rustls
```

For secure token storage on the **device** (user-owned secrets, not skills.sh), see the Authentication section below.

## Architecture Pattern

Follow the same pattern as local data: Tauri commands wrap API calls, TanStack Query provides caching.

```
React Component → TanStack Query → Tauri Command (reqwest) → External API
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

| Task            | Pattern                                  |
| --------------- | ---------------------------------------- |
| Basic API call  | Rust command with reqwest                |
| skills.sh       | Vercel proxy + OIDC (see section above)  |
| Caching         | TanStack Query (frontend) or SQLite      |
| Token storage   | `keyring` crate (OS keychain)            |
| Type safety     | tauri-specta (same as local commands)    |
| Error handling  | Result types, see error-handling.md      |
| Offline support | Cache to SQLite, fallback on network err |
