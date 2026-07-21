# Skill detail page-cache UI

**Milestone:** mvp  
**Depends on:** [task-1-skill-page-cache-schema](./task-1-skill-page-cache-schema.md), [task-2-scrape-local-pipeline](./task-2-scrape-local-pipeline.md), [task-3-daily-list-install-snapshots](./task-3-daily-list-install-snapshots.md), [task-4-skill-audit-api-cache](./task-4-skill-audit-api-cache.md)

## Goal

Rewrite `SkillDetailDialog` to render from **page cache + audits**, not enrichment-centric UI — with an 8-day install sparkline and on-demand audits for uncached skills.

## Context

- Enrichment may exist in DB later; **v1 dialog does not show enrichment**.
- Must show when present: **security audits**, **installs**, **repo link**.
- Show if present: **summary**, **topics**.
- Store-only for now: related (and other sparse snapshot fields).
- Uncached: card metadata + “not cached yet” + Open on skills.sh **and** on-demand `/audit` (task-4).
- Sparkline: existing dither-kit [`Sparkline`](https://www.tripwire.sh/dither-kit) (`src/components/dither-kit/sparkline.tsx`), **8 days**; prefer scraped weekly series, else last 8 `skill_install_snapshots` rows.
- No sync-on-app-open; apps read Supabase/cache only.

## Scope

- [ ] Load page snapshot + audits (+ install series) for the open skill
- [ ] Render audits, installs, repo; optional summary/topics
- [ ] Uncached empty/partial state: list metadata + not-cached copy + Open on skills.sh
- [ ] Trigger on-demand `/audit` for uncached (or missing audits); show results; rely on async persist from task-4
- [ ] 8-day dither-kit sparkline (scraped series → local snapshots fallback)
- [ ] i18n strings for new copy
- [ ] Web + desktop paths via existing Backend API / catalog ports

## Out of scope

- File names / file contents / hyperlinked file tree
- Related skills UI
- LLM / Qdrant / enrichment-driven dialog content
- Growth rails / leaderboard analytics surface

## Done when

- Opening a cached skill shows audits, installs, repo (and summary/topics when present) without a live HTML scrape
- Uncached skill still can show audits via on-demand `/audit`
- Sparkline renders 8 days when either scraped series or local snapshots exist
- `npm run check:all` passes
