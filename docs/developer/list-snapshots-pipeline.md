# List install snapshots (local)

Daily list pass for skills.sh leaderboards. Cheap **list OIDC only** — no
detail, audit, or HTML scrape. Updates latest `install_count` and appends one
`skill_install_snapshots` row per seen skill for the UTC calendar day.

## What it does

1. Paginate `all-time`, `trending`, and `hot` (`per_page` max 500).
2. Deduplicate by `skill_id` (keep the highest install count when views overlap).
3. Upsert `skill_metadata.install_count` for every skill seen.
4. Insert new list members with empty `content_hash` so they join the
   detail/scrape queue; **do not** overwrite an existing hash.
5. Upsert `skill_install_snapshots` for today (`PK (skill_id, date)` → idempotent).

Null/empty hash skills stay queued. Scrape (`npm run scrape:local`) still skips
them until a detail hash exists — this job never scrapes.

GHA scheduling lands in task-6; until then run locally.

## Auth / secrets

Same as scrape: Infisical **`dev`** (Supabase service role) + skills.sh OIDC
(`VERCEL_OIDC_TOKEN`). Prefer an **ingest** Vercel project’s OIDC so you do not
share the app Backend’s 600/min budget. See [infisical.md](./infisical.md) and
[external-apis.md](./external-apis.md).

```bash
npm run list-snapshots:local
```

Progress logs go to stderr; a JSON summary goes to stdout.
