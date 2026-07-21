# Enable and verify Supabase RLS

**Milestone:** mvp (security)
**Depends on:** skill repository + page-cache migrations

## Goal

Confirm every exposed Supabase surface is protected by RLS (and Storage
policies) so anon/publishable keys cannot read or write skill data. Backend
and scripts keep using the secret/service-role key that bypasses RLS.

## Context

Repo migrations already run `alter table ... enable row level security` on
`skill_metadata`, `skill_raw_files`, and `skill_install_snapshots`, with no
public policies (`docs/developer/supabase-repository.md`). Live projects may
still be missing applied migrations, Storage policies, or advisor cleanups.

## Scope

- [ ] Run Supabase security advisors on the skills-explorer project; fix RLS /
      policy findings
- [ ] Verify RLS is enabled on all `public` tables (idempotent migration if
      any table lacks it)
- [ ] Confirm no `anon` / `authenticated` policies grant SELECT/INSERT/UPDATE/
      DELETE on skill tables
- [ ] Lock down `raw-skills` Storage bucket (private + no public object policies)
- [ ] Document verification (advisor green / SQL check) in
      `docs/developer/supabase-repository.md` if anything changes

## Out of scope

- Public read policies or client-side Supabase keys
- Real user auth / per-user RLS (`task-x-post-mvp-9-real-user-auth`)
- Changing the service-role repository access model

## Done when

- Advisors report no "RLS disabled" (or equivalent) on public skill tables
- Anon key cannot read/write skill tables or `raw-skills` objects
- Service-role Backend/scripts still work
- `npm run check:all` passes if code/docs/migrations change
