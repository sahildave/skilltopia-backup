# Skill page-cache schema

**Milestone:** mvp  
**Depends on:** supabase-schema-repository (done)

## Goal

Add Supabase storage for skills.sh page snapshots, security audits, and daily install history so ingest and the detail dialog can read cache instead of live OIDC on every open.

## Context

Grilling locked a scrape/cache plan: HTML page snapshot + `/audit` API results live on `skill_metadata`; install time series needs a separate daily snapshots table. No pipeline or UI in this task — schema and types only.

## Scope

- [ ] Add columns on `skill_metadata`:
  - `page_snapshot` (JSONB, sparse structured snapshot)
  - `audits` (JSONB)
  - `audits_fetched_at` (timestamptz, nullable)
  - `page_scraped_at` (timestamptz, nullable)
  - hash / related fields as needed if not already present
- [ ] New table `skill_install_snapshots`:
  - `skill_id`, `date`, `installs`
  - primary key `(skill_id, date)`
- [ ] Migration + TypeScript / repository types updated to match

## Out of scope

- Scrape or list ingest scripts
- `/audit` proxy or dialog UI
- Snapshot retention / pruning policy

## Done when

- Migration applies cleanly locally and against staging/prod process used by this repo
- Types compile; existing reads of `skill_metadata` still work
- `npm run check:all` passes
