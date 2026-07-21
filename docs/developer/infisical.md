# Infisical secrets

This project uses **Infisical as the single source of truth** for environment secrets. Do not commit `.env` files or hand-edit Vercel env as the primary workflow — store values in Infisical and sync them.

## Environments

| Infisical env | Sync / inject into                                                       | Purpose                                                  |
| ------------- | ------------------------------------------------------------------------ | -------------------------------------------------------- |
| `prod`        | Vercel **Production**                                                    | Deployed Backend API (`api/`)                            |
| `dev`         | Vercel **Preview** / **Development**, local `vercel dev`, enrich scripts | Non-prod Backend + local server work                     |
| `local`       | Tauri desktop via `infisical run`                                        | Desktop-safe vars only (no Supabase / Qdrant / LLM keys) |

Use **separate** Supabase projects and Qdrant clusters (or at least separate keys) for `dev` vs `prod` so local enrichment cannot wipe production data.

skills.sh production auth on Vercel is **OIDC Federation** (project setting), not an Infisical secret. See [external-apis.md](./external-apis.md).

## Who gets which secrets

| Consumer                                      | Infisical env  | Allowed keys                                                                                |
| --------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------- |
| Backend API on Vercel                         | `prod` / `dev` | Full Backend set below                                                                      |
| Local Backend (`vercel dev`) / enrich scripts | `dev`          | Full Backend set                                                                            |
| Tauri desktop                                 | `local`        | Optional `SKILLS_PROXY_BASE_URL` only (`tauri:dev:local` hardcodes `http://127.0.0.1:3000`) |

Package scripts already wrap Infisical. Daily workflow:

```bash
npm run dev:local       # alias of tauri:dev — desktop → deployed Backend (Infisical local)
npm run enrich:local    # Backend secrets from Infisical dev
npm run scrape:local    # Same Infisical dev + OIDC; HTML page cache (no LLM)
npm run list-snapshots:local  # List OIDC only; daily install_count + snapshots
# Full operator path: docs/developer/page-cache-ops.md
npm run rotate:local    # Daily 200-skill rotation (+ queued)
npm run ingest:daily    # list-snapshots then rotation
npm run scrape:sweep    # One-shot leaderboard scrape (default MAX_ENRICHED=1500)
npm run dev:local:proxy # optional: vercel dev :3000 + tauri:dev:local (broken on some macOS; see external-apis.md)
```

```bash
# ❌ BAD: Inject Backend secrets into the desktop process
infisical run --env=dev -- npm run tauri -- dev
```

Never expose Backend secrets through `VITE_*`, the Tauri bundle, or a shared Infisical env that the desktop app loads.

## Backend secrets (`prod` + `dev`)

### Required (MVP tasks 2–3)

| Key                         | Secret?            | Where used                                                                     |
| --------------------------- | ------------------ | ------------------------------------------------------------------------------ |
| `SUPABASE_URL`              | treat as sensitive | `api/_lib/supabase-repository.ts`                                              |
| `SUPABASE_SERVICE_ROLE_KEY` | **yes**            | same — value should be `sb_secret_...` (prefer over legacy JWT `service_role`) |
| `QDRANT_URL`                | treat as sensitive | `api/_lib/qdrant.ts`                                                           |
| `QDRANT_API_KEY`            | **yes**            | same                                                                           |

### Optional Qdrant overrides (defaults in code)

| Key                      | Default                                  |
| ------------------------ | ---------------------------------------- |
| `QDRANT_COLLECTION`      | `skill_embeddings`                       |
| `QDRANT_EMBEDDING_MODEL` | `sentence-transformers/all-MiniLM-L6-v2` |
| `QDRANT_VECTOR_NAME`     | `dense`                                  |
| `QDRANT_VECTOR_SIZE`     | `384`                                    |

Change model id and vector size **together** when switching embedding models.

### Enrichment LLM (task 9 — AI SDK provider chain)

Used by `npm run enrich:local` (Infisical `dev`) and any Backend enrich path that syncs from Infisical. Do **not** put these in `local`.

| Key                            | Secret? | Notes                                                                                                                                                                                                         |
| ------------------------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GROQ_API_KEY`                 | **yes** | `@ai-sdk/groq` default. Primary free model.                                                                                                                                                                   |
| `GOOGLE_GENERATIVE_AI_API_KEY` | **yes** | `@ai-sdk/google` default. Gemini fallback.                                                                                                                                                                    |
| `ENRICHMENT_MODEL_CHAIN`       | no      | Ordered `provider/model` list. Prefer Groq models that support structured outputs (`openai/gpt-oss-20b`). Default in code: `groq/openai/gpt-oss-20b,gemini/gemini-3.1-flash-lite`. Rule-based is always last. |
| `MAX_ENRICHED`                 | no      | Config knob (default **500**, hard-capped at **1500**); bounds `enrich:local`, `scrape:local` (sweep uses `SCRAPE_SWEEP_MAX` / 1500 instead)                                                                  |
| `SCRAPE_SWEEP_MAX`             | no      | Sweep-only corpus size (default **1500** via `scrape:sweep`; avoids Infisical’s enrich default of 500)                                                                                                         |
| `THROTTLE_MS`                  | no      | Pause between skills in ms (default **1000**; `scrape:sweep` / GHA sweep default **250**). Raise on upstream `429`                                                                                            |
| `SCRAPE_SKIP_CACHED`           | no      | When `1`/`true`, skip ids with existing `page_snapshot`. Default **on** for `scrape:sweep` only — never set by daily rotation                                                                                 |
| `VERCEL_OIDC_TOKEN_SECONDARY`  | **yes** | Preferred **secondary** (backend/batch) OIDC from the ingest/partner Vercel project. Used by scrape / list / rotate / enrich / GHA via `skills-catalog`. Not used by app runtime `@vercel/oidc`.              |
| `VERCEL_OIDC_TOKEN`            | **yes** | Optional batch fallback when `VERCEL_OIDC_TOKEN_SECONDARY` is unset. Do not put either token in Infisical `local`.                                                                                            |
| Enrich-route protect secret    | **yes** | Only if a secret-protected Backend enrich route is added                                                                                                                                                      |

Missing provider keys are skipped at runtime; at least one of Groq/Gemini should be set for LLM enrichment. See [enrichment-pipeline.md](./enrichment-pipeline.md). Local HTML scrape/cache (`npm run scrape:local`), daily list snapshots (`npm run list-snapshots:local`), and rotation (`npm run rotate:local` / `ingest:daily`) need Supabase + **secondary** OIDC but not LLM keys — see [scrape-pipeline.md](./scrape-pipeline.md), [list-snapshots-pipeline.md](./list-snapshots-pipeline.md), and [rotation-pipeline.md](./rotation-pipeline.md). Primary (user-facing) OIDC stays on the app Vercel project; secondary is Infisical `VERCEL_OIDC_TOKEN_SECONDARY` — [ingest-oidc.md](./ingest-oidc.md).

Hybrid search, enrichment UI, and seed (tasks 5–8) reuse the Backend set above; they do not add desktop secrets.

## Desktop secrets (`local`)

| Key                     | Secret? | Purpose                                                                                                                             |
| ----------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `SKILLS_PROXY_BASE_URL` | no      | Optional. Point `tauri:dev` / `dev:local` at a Backend deploy. `tauri:dev:local` / `dev:local:proxy` force `http://127.0.0.1:3000`. |

You do **not** need any secrets in Infisical `local` for daily `npm run dev:local`. An empty `local` env is fine (CLI still injects).

Default when unset: `https://skills-explorer-six.vercel.app`.

## How to obtain hard variables

### `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`

1. Create a Supabase project (use a separate project for `dev` vs `prod` if possible).
2. Dashboard → **Project Settings → API Keys** (or the Connect dialog):
   - **Project URL** → `SUPABASE_URL` (form `https://<project-ref>.supabase.co`)
   - Create / copy a **secret** key (`sb_secret_...`) → `SUPABASE_SERVICE_ROLE_KEY`
3. Prefer the new secret key format. The legacy JWT **`service_role`** key still works but is deprecated; both can coexist until you disable the JWT keys in the dashboard. See [Understanding API keys](https://supabase.com/docs/guides/api/api-keys).
4. Apply migrations under `supabase/migrations/` (skill repository + page-cache) to that project before the repository will work.
5. Never put a **publishable** (`sb_publishable_...`) or legacy **`anon`** key here — the repository needs elevated access that bypasses RLS. Never put `SUPABASE_SERVICE_ROLE_KEY` in Tauri / Infisical `local`.

See [supabase-repository.md](./supabase-repository.md).

### `QDRANT_URL` + `QDRANT_API_KEY`

1. Create a [Qdrant Cloud](https://cloud.qdrant.io/) free cluster.
2. Cluster overview → copy the cluster URL → `QDRANT_URL` (no trailing slash required; code strips it).
3. Open **Inference** and confirm the model is labelled **Cost: Free**. Enable Inference manually on older clusters.
4. **Access → API keys** → create a key with write access for upserts → `QDRANT_API_KEY`.
5. Leave optional `QDRANT_*` overrides unset unless you change models; the collection is created lazily on first upsert.

See [qdrant.md](./qdrant.md).

### skills.sh OIDC — primary vs secondary

**Primary (user-facing):** minted at runtime by the **app** Vercel project via
`@vercel/oidc`. Do not store a long-lived skills.sh password in Infisical for
the proxy.

1. Deploy `api/` to Vercel and link the Infisical → Vercel sync for `dev` / `prod`.
2. Vercel project → **Settings → OIDC Federation → On**.
3. Smoke-test `/api/skills` and `/api/skills/search` (see [external-apis.md](./external-apis.md)).

**Secondary (backend/batch):** mint an OIDC token from a **separate** ingest
Vercel project (often a partner account) and store it as
`VERCEL_OIDC_TOKEN_SECONDARY` in Infisical **`dev`**. Batch scripts prefer that
value and fall back to `VERCEL_OIDC_TOKEN` only if secondary is unset. See
[ingest-oidc.md](./ingest-oidc.md) and [page-cache-ops.md](./page-cache-ops.md).

### `SKILLS_SH_TOKEN` — skip for daily work

**You do not need this for `npm run dev:local`.**

That script aliases `tauri:dev`: Tauri talks to the deployed Backend API (default `https://skills-explorer-six.vercel.app`). skills.sh auth stays on the Backend; Tauri never holds a skills.sh credential.

`SKILLS_SH_TOKEN` is an escape hatch only: if set in the Tauri process, Rust **bypasses** the Backend API and calls `https://skills.sh` with that bearer token. Prefer not setting it. Do not put it in `prod` or release builds.

To exercise a **local** Backend (`vercel dev` on `:3000`), use `npm run dev:local:proxy` (or `proxy:dev` + `tauri:dev:local`). On some macOS versions the Vercel CLI fails with `spawn EBADF` when building serverless functions — prefer the deployed Backend path when that happens.

### `GROQ_API_KEY` + `GOOGLE_GENERATIVE_AI_API_KEY` + `ENRICHMENT_MODEL_CHAIN`

1. Create a [Groq](https://console.groq.com/) API key → `GROQ_API_KEY`.
2. Create a [Google AI Studio](https://aistudio.google.com/apikey) key → `GOOGLE_GENERATIVE_AI_API_KEY`.
3. Set `ENRICHMENT_MODEL_CHAIN` to models that support structured JSON (AI SDK `generateObject`). Recommended:

```bash
ENRICHMENT_MODEL_CHAIN=groq/openai/gpt-oss-20b,gemini/gemini-3.1-flash-lite
```

`llama-3.1-8b-instant` on Groq does **not** support `json_schema` and will always fall through to rule-based. Prefer Gemini 3.x (`gemini-3.1-flash-lite` / `gemini-3.5-flash`) — many new keys cannot call `gemini-2.5-*`. 4. Store all three in Infisical **`dev`** (local enrich) and **`prod`** (if prod enrich / Backend needs them). Never in `local`. 5. Run enrichment with `npm run enrich:local` so Infisical injects `dev`. Daily UI (`dev:local`) does not need LLM keys.

## Vercel sync

1. Connect Infisical’s Vercel integration for this project.
2. Map Infisical `prod` → Vercel Production; Infisical `dev` → Vercel Preview / Development.
3. After changing secrets in Infisical, confirm the sync ran (or redeploy) so `process.env` on the Backend API sees the new values.

Local scripts already call `infisical run` (see `package.json`: `dev:local`, `proxy:dev`, `tauri:dev`, `enrich:local`, `scrape:local`). Prefer those over writing `.env.local` files. If you must export for a one-off, keep the file gitignored and delete it after.

## Anti-patterns

```text
# ❌ Commit .env / Infisical exports
# ❌ Put SUPABASE_* / QDRANT_* / LLM keys in Infisical `local` or VITE_*
# ❌ Share one Infisical env between Tauri and Backend
# ❌ Rely on a teammate’s shared production proxy without your own OIDC + Infisical
```
