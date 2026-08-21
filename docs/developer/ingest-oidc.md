# Dual OIDC: primary (user-facing) vs secondary (backend/batch)

Operator checklist (migration, secrets, scripts, GHA): [page-cache-ops.md](./page-cache-ops.md).

skills.sh rate-limits OIDC at **600 requests/minute per (team, project)**. This
repo uses **two** Vercel projects so user-facing traffic and batch ingest do not
share one budget.

The split exists because scrape/list/rotation jobs are predictable batch load,
while the app Backend is interactive user load. If both used the same OIDC
project, a sweep or daily rotation could burn quota and make the public app feel
broken. The secondary token gives batch work its own budget and its own kill
switch without shipping any credentials to the desktop or browser clients.

| Role          | Project                        | Purpose                                         | Who uses its OIDC                                        |
| ------------- | ------------------------------ | ----------------------------------------------- | -------------------------------------------------------- |
| **Primary**   | App Backend (your account)     | Same-origin web + `api/` proxy (`/api/skills*`) | Browser / desktop via Backend; on-demand `/audit`        |
| **Secondary** | Ingest (often partner account) | Batch list / scrape / rotation / enrich / GHA   | Local `*:local` scripts + `.github/workflows/ingest.yml` |

Never put Backend secrets or long-lived skills.sh passwords in the Tauri binary
or web bundle. OIDC tokens are minted per Vercel project (Federation setting).

## Primary — App Backend (user-facing)

1. Deploy this repo’s `api/` + web to the **app** Vercel project.
2. Enable **Settings → OIDC Federation**.
3. Sync Infisical `dev` / `prod` → Vercel env for that project (Supabase, Qdrant,
   LLM keys). See [infisical.md](./infisical.md) and
   [external-apis.md](./external-apis.md).
4. Runtime proxy uses `@vercel/oidc` (`getVercelOidcToken`) — no
   `VERCEL_OIDC_TOKEN` / `VERCEL_OIDC_TOKEN_SECONDARY` secret required on the
   app deploy.

## Secondary — Ingest project (backend/batch)

All scrape, list-snapshots, rotate, enrich, and GHA ingest traffic uses the
**secondary** token. Primary never runs those jobs.

1. Create the ingest project in the **partner Vercel account** (a no-op deploy
   is enough). Enable **OIDC Federation** on that project only for batch work.
2. OIDC tokens expire after 12 hours, so they cannot be stored as static CI
   secrets — a daily cron would send an expired one and get a `401`.
   - **GitHub Actions:** store the partner account's **`VERCEL_TOKEN`** (a
     Vercel API token) and let `ingest.yml` mint a fresh OIDC token per run.
     Leave `VERCEL_OIDC_TOKEN_SECONDARY` unset there; a stale value would sit
     in front of the minted one and mask mint failures.
   - **Local scripts:** store a hand-minted
     **`VERCEL_OIDC_TOKEN_SECONDARY`** in Infisical **`dev`**, and re-mint it
     when it expires.
3. Batch resolution in `api/_lib/skills-catalog.ts` reads
   `VERCEL_OIDC_TOKEN_SECONDARY` and nothing else. There is deliberately no
   fallback to the app project’s `VERCEL_OIDC_TOKEN`: a stale copy would spend
   the app’s budget and mask a missing ingest token.
4. Local scripts (`npm run scrape:local`, `list-snapshots:local`,
   `rotate:local`, `ingest:daily`, `scrape:sweep`, `enrich:local`) expect
   Infisical **`dev`** for Supabase plus `VERCEL_OIDC_TOKEN_SECONDARY` in the
   environment via `infisical run`.

## Pacing

| Job                                | OIDC shape                                         | Notes                                                            |
| ---------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| List snapshots                     | Paginated list only                                | Cheap                                                            |
| Daily rotation (~200 + queued)     | Detail (+ audit when stale) per skill, 1s throttle | ≪ 600/min                                                        |
| Full sweep (`MAX_ENRICHED` ≤ 1500) | Same as scrape, `THROTTLE_MS` default **250**      | Prefer secondary OIDC; raise throttle or use `1000` cap if heavy |

If you see upstream `429`, increase `THROTTLE_MS` / `throttleMs` or lower
`MAX_ENRICHED` — do not point batch jobs at the primary (app Backend) OIDC.
