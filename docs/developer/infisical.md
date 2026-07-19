# Infisical secrets

This project uses **Infisical as the single source of truth** for environment secrets. Do not commit `.env` files or hand-edit Vercel env as the primary workflow — store values in Infisical and sync them.

## Environments

| Infisical env | Sync / inject into | Purpose |
| --- | --- | --- |
| `prod` | Vercel **Production** | Deployed Backend API (`api/`) |
| `dev` | Vercel **Preview** / **Development**, local `vercel dev`, enrich scripts | Non-prod Backend + local server work |
| `local` | Tauri desktop via `infisical run` | Desktop-safe vars only (no Supabase / Qdrant / LLM keys) |

Use **separate** Supabase projects and Qdrant clusters (or at least separate keys) for `dev` vs `prod` so local enrichment cannot wipe production data.

skills.sh production auth on Vercel is **OIDC Federation** (project setting), not an Infisical secret. See [external-apis.md](./external-apis.md).

## Who gets which secrets

| Consumer | Infisical env | Allowed keys |
| --- | --- | --- |
| Backend API on Vercel | `prod` / `dev` | Full Backend set below |
| Local Backend (`vercel dev`) / enrich scripts | `dev` | Full Backend set |
| Tauri desktop | `local` | `SKILLS_PROXY_BASE_URL`, optional `SKILLS_SH_TOKEN` only |

```bash
# ✅ GOOD: Backend / enrich with Infisical
infisical run --env=dev -- npm run proxy:dev
infisical run --env=dev -- npm run <enrich-script>

# ✅ GOOD: Tauri with desktop-safe Infisical env
infisical run --env=local -- npm run tauri:dev
infisical run --env=local -- npm run tauri:dev:local

# ❌ BAD: Inject Backend secrets into the desktop process
infisical run --env=dev -- npm run tauri:dev
```

Never expose Backend secrets through `VITE_*`, the Tauri bundle, or a shared Infisical env that the desktop app loads.

## Backend secrets (`prod` + `dev`)

### Required (MVP tasks 2–3)

| Key | Secret? | Where used |
| --- | --- | --- |
| `SUPABASE_URL` | treat as sensitive | `api/_lib/supabase-repository.ts` |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes** | same |
| `QDRANT_URL` | treat as sensitive | `api/_lib/qdrant.ts` |
| `QDRANT_API_KEY` | **yes** | same |

### Optional Qdrant overrides (defaults in code)

| Key | Default |
| --- | --- |
| `QDRANT_COLLECTION` | `skill_embeddings` |
| `QDRANT_EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` |
| `QDRANT_VECTOR_NAME` | `dense` |
| `QDRANT_VECTOR_SIZE` | `384` |

Change model id and vector size **together** when switching embedding models.

### Coming with enrichment (task 4)

| Key | Notes |
| --- | --- |
| LLM provider key(s) | Env-driven AI SDK chain. Exact names TBD when the provider is chosen (e.g. Vercel AI Gateway, OpenAI, Anthropic). Add to `dev` / `prod` then. |
| `MAX_ENRICHED` | Config knob (starts at `500`), not a secret — optional in Infisical |
| Enrich-route protect secret | Only if a secret-protected Backend enrich route is added |

Hybrid search, enrichment UI, and seed (tasks 5–8) reuse the Backend set above; they do not add desktop secrets.

## Desktop secrets (`local`)

| Key | Secret? | Purpose |
| --- | --- | --- |
| `SKILLS_PROXY_BASE_URL` | no | Point Tauri at your Backend deploy or `http://127.0.0.1:3000` for local proxy |
| `SKILLS_SH_TOKEN` | **yes** | Maintainer-only: bypass proxy and call skills.sh directly |

Default proxy without Infisical: `https://skills-explorer-six.vercel.app`. Forks should set `SKILLS_PROXY_BASE_URL` to their own Vercel host.

## How to obtain hard variables

### `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`

1. Create a Supabase project (use a separate project for `dev` vs `prod` if possible).
2. Dashboard → **Project Settings → API**:
   - **Project URL** → `SUPABASE_URL` (form `https://<project-ref>.supabase.co`)
   - **service_role** key (secret) → `SUPABASE_SERVICE_ROLE_KEY`
3. Apply `supabase/migrations/20260719000000_create_skill_repository.sql` to that project before the repository will work.
4. Never put the `anon` / publishable key in Infisical as a substitute for `service_role` — the repository requires service role. Never put `service_role` in Tauri / `local`.

See [supabase-repository.md](./supabase-repository.md).

### `QDRANT_URL` + `QDRANT_API_KEY`

1. Create a [Qdrant Cloud](https://cloud.qdrant.io/) free cluster.
2. Cluster overview → copy the cluster URL → `QDRANT_URL` (no trailing slash required; code strips it).
3. Open **Inference** and confirm the model is labelled **Cost: Free**. Enable Inference manually on older clusters.
4. **Access → API keys** → create a key with write access for upserts → `QDRANT_API_KEY`.
5. Leave optional `QDRANT_*` overrides unset unless you change models; the collection is created lazily on first upsert.

See [qdrant.md](./qdrant.md).

### skills.sh on Vercel (not Infisical)

1. Deploy `api/` to Vercel and link the Infisical → Vercel sync for `dev` / `prod`.
2. Vercel project → **Settings → OIDC Federation → On**.
3. Smoke-test `/api/skills` and `/api/skills/search` (see [external-apis.md](./external-apis.md)).

OIDC tokens are minted at runtime by Vercel; do not store a long-lived skills.sh password in Infisical for the proxy.

### `SKILLS_SH_TOKEN` (maintainer / no `vercel dev`)

Only for local Tauri when you want to hit skills.sh **directly** instead of the proxy:

1. Prefer day-to-day: `infisical run --env=dev -- npm run proxy:dev` + `infisical run --env=local -- npm run tauri:dev:local` so OIDC stays on the Backend.
2. If you must bypass the proxy: obtain a short-lived Vercel OIDC token from a linked project (`vercel env pull` / platform token flow) and store it in Infisical `local` as `SKILLS_SH_TOKEN`.
3. Rotate often; never commit exports. Do not put this in release builds or `prod`.

### LLM keys (task 4+)

When enrichment lands, add the chosen provider’s API key to Infisical `dev` / `prod` only. Prefer one env-driven chain documented in the enrichment task. Do not add LLM keys to `local`.

## Vercel sync

1. Connect Infisical’s Vercel integration for this project.
2. Map Infisical `prod` → Vercel Production; Infisical `dev` → Vercel Preview / Development.
3. After changing secrets in Infisical, confirm the sync ran (or redeploy) so `process.env` on the Backend API sees the new values.

Local inject pattern remains `infisical run --env=… -- <command>` — prefer that over writing `.env.local` files. If you must export for a one-off, keep the file gitignored and delete it after.

## Anti-patterns

```text
# ❌ Commit .env / Infisical exports
# ❌ Put SUPABASE_* / QDRANT_* / LLM keys in Infisical `local` or VITE_*
# ❌ Share one Infisical env between Tauri and Backend
# ❌ Rely on a teammate’s shared production proxy without your own OIDC + Infisical
```
