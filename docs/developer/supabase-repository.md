# Supabase skill repository

The Backend API and local enrichment scripts use `api/_lib/supabase-repository.ts` as the only Supabase integration point. Tauri and browser code must not import the Supabase client or use Supabase keys.

## Setup

Apply migrations under `supabase/migrations/` to the Supabase project (skill repository first, then page-cache). Store these keys in Infisical (`dev` / `prod` only — never the desktop `local` env) and sync to Vercel for the Backend API. See [infisical.md](./infisical.md) for how to obtain them and inject locally:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
# Prefer new secret key (sb_secret_...). Legacy JWT service_role still works.
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

The migrations create `skill_metadata`, `skill_raw_files`, and `skill_install_snapshots`, plus a private `raw-skills` Storage bucket. `skill_metadata` also holds sparse `page_snapshot` / `audits` JSON and scrape timestamps for the page-cache pipeline. Tables have RLS enabled without public policies, so public clients cannot read or write them. The repository uses an elevated **secret** key (`sb_secret_...`, env name `SUPABASE_SERVICE_ROLE_KEY`) in trusted server-side code; never expose it through `VITE_*` or the Tauri bundle. Do not use a publishable / `anon` key here — the repository must bypass RLS.

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

Postgres stores metadata, hashes, enrichment JSON, page/audit cache columns, and Storage pointers. Raw Markdown and supporting files are uploaded to Storage and are never copied into a Postgres text column. `getByContentHash` returns only already-enriched matches; `listMissingEnrichment` returns metadata rows whose required enrichment is still null. Page-cache helpers: `upsertPageSnapshot`, `countInstallSnapshots`, `upsertInstallSnapshots` (used by [scrape-pipeline.md](./scrape-pipeline.md)).
