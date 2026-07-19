# Supabase skill repository

The Backend API and local enrichment scripts use `api/_lib/supabase-repository.ts` as the only Supabase integration point. Tauri and browser code must not import the Supabase client or use Supabase keys.

## Setup

Apply `supabase/migrations/20260719000000_create_skill_repository.sql` to the Supabase project. Store these keys in Infisical (`dev` / `prod` only — never the desktop `local` env) and sync to Vercel for the Backend API. See [infisical.md](./infisical.md) for how to obtain them and inject locally:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only-secret>
```

The migration creates the `skill_metadata` and `skill_raw_files` tables and a private `raw-skills` Storage bucket. Both tables have RLS enabled without public policies, so public clients cannot read or write them. The repository uses the service-role key in trusted server-side code; never expose it through `VITE_*` or the Tauri bundle.

## Repository contract

```ts
const repository = createSupabaseRepositoryFromEnv()

await repository.putRawSkillFiles(skillId, [
  { path: 'SKILL.md', content: markdown },
])

await repository.upsertSkillEnrichment({
  skillId,
  contentHash,
  required: { primaryGoal, requires, estimatedComplexity, bestFor },
  optional: { worksWith, outputs, confidence },
  estimatedReadTimeMinutes: estimateReadTimeMinutes(markdown),
})
```

Postgres stores metadata, hashes, enrichment JSON, and Storage pointers. Raw Markdown and supporting files are uploaded to Storage and are never copied into a Postgres text column. `getByContentHash` returns only already-enriched matches; `listMissingEnrichment` returns metadata rows whose required enrichment is still null.
