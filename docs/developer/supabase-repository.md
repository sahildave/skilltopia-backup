# Supabase skill repository

The Backend API and local enrichment scripts use `api/_lib/supabase-repository.ts` as the only Supabase integration point. Tauri and browser code must not import the Supabase client or use Supabase keys.

## Setup

Apply migrations under `supabase/migrations/` to the Supabase project (skill
repository first, then page-cache, then `source` column). Store these keys in
Infisical (`dev` / `prod` only — never the desktop `local` env) and sync to
Vercel for the Backend API. See [infisical.md](./infisical.md) for how to obtain
them and inject locally:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
# Prefer new secret key (sb_secret_...). Legacy JWT service_role still works.
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

The migrations create `skill_metadata`, `skill_raw_files`, and `skill_install_snapshots`, plus a private `raw-skills` Storage bucket. `skill_metadata` also holds sparse `page_snapshot` / `audits` JSON and scrape timestamps for the page-cache pipeline. GitHub origins live in `repository` (`owner/repo`); non-GitHub origins live in `source` (absolute URL). `source_url` is the skills.sh catalog page URL. Tables have RLS enabled without public policies, so public clients cannot read or write them. The repository uses an elevated **secret** key (`sb_secret_...`, env name `SUPABASE_SERVICE_ROLE_KEY`) in trusted server-side code; never expose it through `VITE_*` or the Tauri bundle. Do not use a publishable / `anon` key here — the repository must bypass RLS.

## RLS and Storage verification

Idempotent hardening lives in:

- `supabase/migrations/20260721033300_ensure_skill_repository_rls.sql` — enable RLS on skill tables, drop any public policies, keep `raw-skills` private and strip object policies that mention it
- `supabase/migrations/20260721034000_revoke_rls_auto_enable_execute.sql` — revoke `EXECUTE` on `public.rls_auto_enable()` from `PUBLIC` / `anon` / `authenticated` (event-trigger helper must not be callable via PostgREST)

After `supabase db push --linked`:

```bash
supabase db advisors --linked --type security
# expect: No issues found
```

SQL checks (linked project or SQL editor):

```sql
select c.relname, c.relrowsecurity
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('skill_metadata', 'skill_raw_files', 'skill_install_snapshots');
-- all relrowsecurity = true

select * from pg_policies
where schemaname = 'public'
  and tablename in ('skill_metadata', 'skill_raw_files', 'skill_install_snapshots');
-- zero rows

select id, public from storage.buckets where id = 'raw-skills';
-- public = false
```

Anon / publishable key smoke test: `SELECT` returns `[]`, `INSERT`/`UPDATE`/`DELETE` fail with RLS (`42501`); listing `raw-skills` objects yields no readable files; `/storage/v1/object/public/raw-skills/...` does not serve the private bucket. Secret / service-role key continues to read and write as before.

## Repository contract

```ts
const repository = createSupabaseRepositoryFromEnv();

await repository.putRawSkillFiles(skillId, [{ path: 'SKILL.md', content: markdown }]);

await repository.upsertSkillEnrichment({
  skillId,
  contentHash,
  required: { primaryGoal, requires, estimatedComplexity, bestFor },
  optional: { worksWith, outputs, confidence },
  estimatedReadTimeMinutes: estimateReadTimeMinutes(markdown),
});
```

Postgres stores metadata, hashes, enrichment JSON, page/audit cache columns, and Storage pointers. Raw Markdown and supporting files are uploaded to Storage and are never copied into a Postgres text column. `getByContentHash` returns only already-enriched matches; `listMissingEnrichment` returns metadata rows whose required enrichment is still null. Page-cache helpers: `upsertPageSnapshot`, `getSkillPageCache`, `listInstallSnapshots`, `getSkillAuditCache`, `upsertSkillAudits`, `countInstallSnapshots`, `upsertInstallSnapshots` (used by [scrape-pipeline.md](./scrape-pipeline.md), [audit-cache.md](./audit-cache.md), and the skill detail dialog). List ingest: `syncListSkills` preserves existing `content_hash`, inserts new skills with empty hash (detail/scrape queue), and refreshes `install_count` ([list-snapshots-pipeline.md](./list-snapshots-pipeline.md)).
