# Scrape pipeline (local)

For the full operator path (manual setup + script order), see
[page-cache-ops.md](./page-cache-ops.md).

Run the bounded HTML scrape/cache pipeline with `npm run scrape:local`
(Infisical **`dev`**). It is separate from `npm run enrich:local` (LLM
enrichment + Qdrant). This path detail-fetches skills.sh (hash-gated), scrapes
public skill pages into sparse `page_snapshot`, and optionally seeds early
`skill_install_snapshots` rows.

## Why it exists

The skills.sh list endpoints are good for search, ranking, and current install
counts, but they do not contain every field needed for a rich skill detail
experience. The public HTML pages expose useful human-facing context such as
summaries, topics, repository/source labels, SKILL.md previews, related skills,
and weekly install series.

We scrape those pages in a controlled batch pipeline and cache the result in
Supabase so:

- opening a skill detail page does not scrape live HTML;
- web and desktop clients do not need skills.sh credentials;
- install-history sparklines can use scraped weekly series when available;
- the app can tolerate partial data because `page_snapshot` is sparse and every
  parsed field is optional.

Scrape jobs use the secondary ingest OIDC budget, not the primary app Backend
budget. That keeps batch work from starving user-facing catalog traffic.

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

Uses Infisical **`dev`** (Supabase service role) plus a skills.sh OIDC token.
Batch jobs prefer `VERCEL_OIDC_TOKEN_SECONDARY` from the ingest Vercel project
and nothing else — there is no fallback to the app project's
`VERCEL_OIDC_TOKEN`, because that would share the user-facing 600/min budget. See [infisical.md](./infisical.md),
[external-apis.md](./external-apis.md), and [ingest-oidc.md](./ingest-oidc.md).

HTML page fetches are unauthenticated. GitHub skills use
`https://www.skills.sh/{owner}/{repo}/{skill}`; well-known skills use
`https://www.skills.sh/site/{domain}/{skill}` (detail API omits `url`, so the
scrape reconstructs from id shape — see `skillPageUrl`, with path segments
percent-encoded). **Always write under the requested catalog `skillId`**, not
`detail.id`: the skills.sh detail API sometimes strips characters (e.g.
`react:components` → `reactcomponents`). On mismatch, keep list
`install_count` when present and log a warning. API `source` is
classified into `skill_metadata.repository` (GitHub `owner/repo`) or
`skill_metadata.source` (external origin URL). `source_url` remains the
skills.sh page URL. HTML parsing also stores `page_snapshot.repository` /
`page_snapshot.source` from the Repository vs Source labels.

```bash
MAX_ENRICHED=20 npm run scrape:local
# Re-scrape specific skills (skips leaderboard; does not use MAX_ENRICHED as the count)
SKILL_IDS=open.feishu.cn/lark-approval,open.feishu.cn/lark-doc npm run scrape:local
# Full sweep: SCRAPE_SKIP_CACHED=1, THROTTLE_MS=250, MAX_ENRICHED=1500
npm run scrape:sweep
# SCRAPE_SWEEP_MAX=1000 npm run scrape:sweep   # lighter fallback
# SCRAPE_SKIP_CACHED=0 npm run scrape:sweep    # force re-scrape cached rows
```

Invalid/missing `MAX_ENRICHED` defaults to **500**; hard-capped at **1500**. Invalid/missing
`THROTTLE_MS` defaults to **1000** ms (`scrape:local` / daily rotation);
`scrape:sweep` defaults to **250** ms and **`SCRAPE_SKIP_CACHED=1`** (drop ids that
already have `page_snapshot`). Daily `ingest:daily` / `rotate:local` never enable
`skipCached` — they always re-scrape their selected ids. Progress
logs go to stderr; a JSON summary goes to stdout. **Ctrl+C** aborts after the current
skill (second Ctrl+C force-quits). Without `SKILL_IDS`, `scrape:local` always walks
the leaderboard cap — that env is ignored unless this script reads it (it does now).

Batch jobs should use the **ingest** Vercel project’s OIDC (not the app Backend).
See [ingest-oidc.md](./ingest-oidc.md). Daily rotation:
[rotation-pipeline.md](./rotation-pipeline.md).
