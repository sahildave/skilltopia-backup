# Scrape local pipeline

**Milestone:** mvp  
**Depends on:** [task-1-skill-page-cache-schema](./task-1-skill-page-cache-schema.md)

## Goal

Ship a local `scrape:local` ingest path that detail-fetches (hash-gated), scrapes skills.sh HTML into `page_snapshot`, and optionally seeds early install history — without burning app OIDC or coupling to LLM enrichment.

## Context

- Cap via existing `MAX_ENRICHED`; ramp **20 → 100** before GHA/1500 (task-6).
- Detail `hash` is only on the skills.sh detail API; **skip scrape until hash is non-null**.
- Schema reference page: [frontend-design](https://www.skills.sh/anthropics/skills/frontend-design) (variable sections; sparse JSON OK).
- Spike: 8-day weekly installs are in SSR HTML (`aria-label` and/or RSC `"values":[...]`) — no hover required.
- **Ingest** Vercel project OIDC ≠ **app** Backend OIDC; this script uses ingest credentials.

## Scope

- [ ] Keep **`scrape:local`** and **`enrich:local`** as separate scripts/npm entries
- [ ] For each skill under the cap: detail call → skip if `hash` null
- [ ] HTML scrape → full sparse `page_snapshot` on `skill_metadata` (summary, topics, repo, stars, first seen, install command, related, weekly installs, SKILL.md preview, etc. — all optional)
- [ ] No file tree / file contents
- [ ] Detail OK + scrape fail → **one in-process retry**, then save hash/metadata, leave `page_snapshot` null for later rotation
- [ ] Parse weekly install series from SSR when present
- [ ] Backfill `skill_install_snapshots` from scraped weekly series **only if** that skill has **&lt; 8** rows; map `values[i]` → last 8 UTC calendar days (`scrape_date - (7 - i)`); do not clobber longer local history
- [ ] Wire ingest-project OIDC / secrets for local runs (Infisical `local` / docs as needed)

## Out of scope

- `/audit` API fetch (task-4)
- Detail dialog UI (task-5)
- GHA, 1500 sweep, 200/day rotation (task-6)
- Related / enrichment in UI

## Done when

- `npm run scrape:local` (or equivalent) can land page snapshots for a small cap (e.g. 20) with non-null hashes
- Null-hash skills are skipped cleanly
- Weekly series backfill only when snapshot row count &lt; 8
- `npm run check:all` passes
