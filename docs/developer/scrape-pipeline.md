# Scrape pipeline (local)

Run the bounded HTML scrape/cache pipeline with `npm run scrape:local`
(Infisical **`dev`**). It is separate from `npm run enrich:local` (LLM
enrichment + Qdrant). This path detail-fetches skills.sh (hash-gated), scrapes
public skill pages into sparse `page_snapshot`, and optionally seeds early
`skill_install_snapshots` rows.

## What it does

1. Load the leaderboard slice (cap via `MAX_ENRICHED`, same knob as enrichment).
2. For each skill: call the detail API.
3. **Skip** when `hash` is null (no scrape, no failure).
4. Upsert skill metadata (hash, installs, URLs).
5. Refresh `/audit` via `refreshSkillAuditsIfNeeded` when hash changed or audits
   are older than 7 days (see [audit-cache.md](./audit-cache.md)). Audit failures
   are logged and do not fail the scrape.
6. Fetch the public HTML page; parse a sparse `SkillPageSnapshot`.
7. On scrape failure: **one in-process retry**, then keep metadata/hash and do
   **not** overwrite an existing `page_snapshot` (leave null if never scraped).
8. If the snapshot includes weekly installs **and** that skill has fewer than 8
   install-snapshot rows, backfill up to the last 8 UTC days
   (`values[i]` → `scrape_date - (7 - i)`). Longer local history is not
   overwritten by skipping when row count ≥ 8.

## Auth / secrets

Uses Infisical **`dev`** (Supabase service role) plus a skills.sh OIDC token
(`VERCEL_OIDC_TOKEN`), same local pattern as enrichment. Prefer an **ingest**
Vercel project’s OIDC for scrape/enrich batch work so you do not share the app
Backend’s 600/min budget. See [infisical.md](./infisical.md) and
[external-apis.md](./external-apis.md).

HTML page fetches are unauthenticated (`https://skills.sh/...`).

```bash
MAX_ENRICHED=20 npm run scrape:local
```

Invalid/missing `MAX_ENRICHED` defaults to 500 (hard-capped in code). Progress
logs go to stderr; a JSON summary goes to stdout.
