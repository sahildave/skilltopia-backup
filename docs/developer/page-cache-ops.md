# Page-cache ops (manual setup + scripts)

One place for **human setup** and **which npm scripts to run** after the
scrape/cache MVP (schema, scrape, list snapshots, audit cache, rotation/GHA).
Pipeline internals live in the linked docs; this page is the operator path.

## Manual work (one-time)

Do these before local scrape or GHA will succeed.

### 1. Supabase migration

Apply all files under `supabase/migrations/` to the **dev** (and later **prod**)
project, including `20260720160027_skill_page_cache.sql` and
`20260721030000_skill_source_column.sql`:

- `skill_metadata`: `page_snapshot`, `audits`, `audits_fetched_at`, `page_scraped_at`, `source`
- table `skill_install_snapshots` (`skill_id`, `date`, `installs`)
- `source` holds external non-GitHub origins; host-like values previously in
  `repository` are moved there by the migration

```bash
# linked project / your usual flow
npx supabase db push
# or apply the SQL in the Supabase SQL editor
```

Confirm Infisical **`dev`** (and Vercel app env) already have `SUPABASE_URL` +
`SUPABASE_SERVICE_ROLE_KEY`. See [infisical.md](./infisical.md) and
[supabase-repository.md](./supabase-repository.md).

### 2. Primary — App Backend Vercel (user traffic + on-demand `/audit`)

1. Deploy this repo’s web + `api/` to the **app** Vercel project.
2. **Settings → OIDC Federation → On** (runtime uses `@vercel/oidc`; no
   batch OIDC secret on the app deploy).
3. Sync Infisical `dev` / `prod` → that project’s env.

On-demand audits use **primary** (app) OIDC. See [audit-cache.md](./audit-cache.md).

### 3. Secondary — Ingest Vercel project (backend/batch OIDC)

Batch list/scrape/rotation/enrich must **not** share the app’s 600/min
skills.sh budget. All of those jobs use the **secondary** token.

1. Create a **separate** Vercel project (partner account is fine); enable
   **OIDC Federation**.
2. Mint a short-lived OIDC token for **that** project and store it in Infisical
   **`dev`** as **`VERCEL_OIDC_TOKEN_SECONDARY`** (preferred). Optional fallback:
   Batch reads `VERCEL_OIDC_TOKEN_SECONDARY` only — there is no fallback.
3. Do **not** store long-lived skills.sh passwords; refresh the token when it
   expires.

Details: [ingest-oidc.md](./ingest-oidc.md).

### 4. GitHub Actions secrets (for scheduled ingest)

On the GitHub repo, set secrets used by `.github/workflows/ingest.yml`
(**secondary** ingest project values, not app primary):

| Secret                        | Source                                                    |
| ----------------------------- | --------------------------------------------------------- |
| `SUPABASE_URL`                | Same Supabase project the app Backend uses                |
| `SUPABASE_SERVICE_ROLE_KEY`   | Service role / secret key                                 |
| `VERCEL_OIDC_TOKEN_SECONDARY` | Preferred: token minted for the **ingest** Vercel project |

Until secondary OIDC plus Supabase secrets are set, the daily cron
and `workflow_dispatch` sweep will fail. Local scripts work with Infisical
`VERCEL_OIDC_TOKEN_SECONDARY` (or `VERCEL_OIDC_TOKEN` fallback).

### 5. Optional: Infisical `MAX_ENRICHED`

Default in code is **500** (hard cap **1500**). For the ramp, either set
`MAX_ENRICHED` in Infisical `dev` or override on the command line (below).

LLM keys are **not** required for scrape / list / rotate.

---

## Scripts to run

All `*:local` / `ingest:daily` / `scrape:sweep` entries use
`infisical run --env=dev`. Prefer **`VERCEL_OIDC_TOKEN_SECONDARY`** in Infisical
`dev` (ingest/partner project). If unset, batch requests go out unauthenticated
and skills.sh answers `401`.

Progress logs → stderr; JSON summary → stdout.

### Ramp (local, before relying on GHA)

```bash
# 1) Seed daily install history + queue new list members (cheap list OIDC)
npm run list-snapshots:local

# 2) First page-cache fill — start small
MAX_ENRICHED=20 npm run scrape:local

# 3) Bump after sanity-checking dialogs / Supabase rows
MAX_ENRICHED=100 npm run scrape:local

# Optional: LLM enrichment is separate (needs Groq/Gemini keys)
# MAX_ENRICHED=20 npm run enrich:local
```

### Daily ops (local stand-in for GHA)

```bash
# List pass then ~200-skill rotation (hash-gated scrape + audit refresh)
npm run ingest:daily

# Or separately:
npm run list-snapshots:local
npm run rotate:local
```

`npm run ingest:daily` is exactly what the scheduled workflow runs
(`node --import tsx/esm scripts/ingest-daily.mjs`). The only difference is
where the OIDC token comes from: CI mints a fresh one per run, locally you
supply one from Infisical `dev`. Everything else — same script, same Supabase,
same upstream — so a local run writes to the **same** tables as the cron.

#### Refreshing the local ingest token

Local batch runs read `VERCEL_OIDC_TOKEN_SECONDARY` from Infisical `dev`.
Vercel OIDC tokens last **12 hours**, so an untouched one is always stale.
The symptom is `skills.sh request failed: 401` on the first list page.

Mint a new one from the ingest project (needs the partner account's
`VERCEL_TOKEN`, or `vercel login` as that account):

```bash
infisical secrets set VERCEL_OIDC_TOKEN_SECONDARY="$(vercel project token skills-explorer \
  --scope indhujas-projects --token "$VERCEL_TOKEN" --format=json --yes \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=s.slice(s.indexOf("{"),s.lastIndexOf("}")+1);process.stdout.write(JSON.parse(j).token)})')" --env=dev
```

The brace-slice parse is not decoration: `vercel project token` pretty-prints
JSON across several lines, so a naive last-line parse gets `}` and throws.

#### Reading a token instead of guessing

Decoding the payload tells you which account issued it and when it dies,
which beats re-minting blind:

```bash
infisical secrets get VERCEL_OIDC_TOKEN_SECONDARY --env=dev --plain --silent \
  | cut -d. -f2 | base64 -d 2>/dev/null | python3 -m json.tool | grep -E '"(iss|exp)"'
```

`iss` must end in the **ingest** account (`.../indhujas-projects`). If it names
the app account, batch work is spending the user-facing 600/min budget.

#### When a local run fails, it is usually one of three things

| Symptom                                   | Cause                                                                                    |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| `skills.sh request failed: 401`           | Stale or app-scoped `VERCEL_OIDC_TOKEN_SECONDARY`. Re-mint as above.                     |
| `Supabase repository error: fetch failed` | Supabase project **paused** — the subdomain stops resolving (NXDOMAIN). Resume it.       |
| `skills.sh request failed: 429`/`5xx`     | Upstream throttle or blip. `fetchJson` retries twice; raise `THROTTLE_MS` if persistent. |

### Full corpus sweep (after ~100 looks good)

```bash
# Prefer 1500; fall back to 1000 if wall clock / load is too high
# Sweep defaults: THROTTLE_MS=250, SCRAPE_SKIP_CACHED=1 (skip existing page_snapshot)
npm run scrape:sweep
# SCRAPE_SWEEP_MAX=1000 npm run scrape:sweep
# THROTTLE_MS=500 npm run scrape:sweep  # if 429s
```

Same effect via GitHub Actions → **Ingest** workflow → `workflow_dispatch` →
`mode=sweep`, `max_enriched=1500` (or `1000`).

### Script map

| npm script             | What it runs                                                    | OIDC shape                                             |
| ---------------------- | --------------------------------------------------------------- | ------------------------------------------------------ |
| `list-snapshots:local` | Leaderboard list → installs + snapshots                         | List pages only                                        |
| `scrape:local`         | Cap via `MAX_ENRICHED`, or `SKILL_IDS=a,b` for an explicit list | Detail (+ audit when stale) per skill                  |
| `rotate:local`         | 200-slot rotation + empty-hash queue                            | Same as scrape on selected ids                         |
| `ingest:daily`         | List then rotation                                              | List + rotation                                        |
| `scrape:sweep`         | One-shot scrape to `MAX_ENRICHED`                               | Same as scrape; long run                               |
| `page-cache:coverage`  | TSV/canvas of cached snapshot fields                            | None (public Backend `/api/skills/page-cache` batches) |
| `enrich:local`         | LLM enrichment (optional)                                       | Detail + provider APIs; not required for UI cache      |

Pipeline docs: [list-snapshots-pipeline.md](./list-snapshots-pipeline.md),
[scrape-pipeline.md](./scrape-pipeline.md),
[rotation-pipeline.md](./rotation-pipeline.md),
[audit-cache.md](./audit-cache.md).

---

## Ongoing (after ramp)

1. Keep GHA **Ingest** enabled (`cron: 15 6 * * *` UTC = list + rotation).
2. Refresh **`VERCEL_OIDC_TOKEN_SECONDARY`** (and optional
   in Infisical when the ingest token expires. GitHub Actions mints its own
   per run from `VERCEL_TOKEN`; the app deploy needs neither.
3. Re-run a sweep only when growing the corpus or after a large schema/parser
   change.
4. App users never run these scripts — they read Supabase via
   `GET /api/skills/detail` and on-demand `GET /api/skills/audit`.

## Verify

- Supabase: rows with non-null `page_snapshot` / `audits`; growing
  `skill_install_snapshots`.
- App: open a cached skill in the detail dialog (page fields + audits +
  sparkline when series exist).
- Uncached skill: still gets on-demand audits from the app Backend.
- Field coverage (summary / weekly installs / etc.) against the Backend
  page-cache batch API — TSV on stdout; optional Cursor canvas:

```bash
MAX_ENRICHED=20 npm run page-cache:coverage -- --canvas
MAX_ENRICHED=50 npm run page-cache:coverage -- --canvas
MAX_ENRICHED=200 npm run page-cache:coverage -- --canvas
MAX_ENRICHED=1500 npm run page-cache:coverage -- --canvas
# SKILL_IDS=owner/repo/a,owner/repo/b npm run page-cache:coverage
```

`MAX_ENRICHED` uses the same helper as scrape (`maxEnrichedFromEnv`: default
**500**, hard cap **1500**). Coverage loads ids from the leaderboard (or
`SKILL_IDS`), then fetches snapshot fields in batches of 100 via
`GET /api/skills/page-cache` (paginates leaderboard at `per_page` ≤ 500).
Coverage is tiered: **primary** (`source`/`repository` as alternatives,
`summary`, installs), **secondary** (`skillMdPreview`, `installCommand`),
**tertiary** (`topics`, `related`, `stars`, `firstSeen`). Columns follow that
order plus `d1`–`d8` weekly values. `MISSING` cells are gaps to compare on the
skills.sh page URL (`/site/{id}` for well-known skills,
`/{owner}/{repo}/{skill}` for GitHub).
