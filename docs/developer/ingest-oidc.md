# Dual OIDC: app Backend vs ingest

skills.sh rate-limits OIDC at **600 requests/minute per (team, project)**. This
repo uses **two** Vercel projects so user-facing traffic and batch ingest do not
share one budget.

| Project         | Purpose                                         | Who uses its OIDC                                        |
| --------------- | ----------------------------------------------- | -------------------------------------------------------- |
| **App Backend** | Same-origin web + `api/` proxy (`/api/skills*`) | Browser / desktop via Backend; on-demand `/audit`        |
| **Ingest**      | Batch list / scrape / rotation / enrich / GHA   | Local `*:local` scripts + `.github/workflows/ingest.yml` |

Never put Backend secrets or long-lived skills.sh passwords in the Tauri binary
or web bundle. OIDC tokens are minted per Vercel project (Federation setting).

## App Backend

1. Deploy this repo’s `api/` + web to the **app** Vercel project.
2. Enable **Settings → OIDC Federation**.
3. Sync Infisical `dev` / `prod` → Vercel env for that project (Supabase, Qdrant,
   LLM keys). See [infisical.md](./infisical.md) and
   [external-apis.md](./external-apis.md).
4. Runtime proxy uses `@vercel/oidc` (`getVercelOidcToken`) — no
   `VERCEL_OIDC_TOKEN` secret required on the app deploy.

## Ingest project

1. Create a **separate** Vercel project (can point at the same repo or a no-op
   deploy). Enable **OIDC Federation** on that project only for batch work.
2. Mint a short-lived OIDC token for that project (Vercel dashboard / linked
   CLI) and set it as `VERCEL_OIDC_TOKEN` when running batch jobs.
3. Store the same value in GitHub Actions secrets for
   `.github/workflows/ingest.yml` (plus `SUPABASE_URL` /
   `SUPABASE_SERVICE_ROLE_KEY`). Do **not** reuse the app project’s token.
4. Local scripts (`npm run scrape:local`, `list-snapshots:local`,
   `rotate:local`, `ingest:daily`, `scrape:sweep`, `enrich:local`) expect
   Infisical **`dev`** for Supabase and `VERCEL_OIDC_TOKEN` from the ingest
   project in the environment.

## Pacing

| Job                                | OIDC shape                                         | Notes                                        |
| ---------------------------------- | -------------------------------------------------- | -------------------------------------------- |
| List snapshots                     | Paginated list only                                | Cheap                                        |
| Daily rotation (~200 + queued)     | Detail (+ audit when stale) per skill, 1s throttle | ≪ 600/min                                    |
| Full sweep (`MAX_ENRICHED` ≤ 1500) | Same as scrape, longer wall clock                  | Prefer ingest OIDC; fallback `1000` if heavy |

If you see upstream `429`, increase `throttleMs` or lower `MAX_ENRICHED` — do
not point batch jobs at the app Backend OIDC.
