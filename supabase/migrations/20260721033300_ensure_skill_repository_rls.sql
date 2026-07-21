-- Idempotent hardening: RLS on skill tables, no public policies, private raw-skills bucket.
-- Service-role / secret key bypasses RLS; anon/authenticated must get zero row/object access.

alter table public.skill_metadata enable row level security;
alter table public.skill_raw_files enable row level security;
alter table public.skill_install_snapshots enable row level security;

do $$
declare
  policy_rec record;
begin
  for policy_rec in
    select policyname, tablename
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'skill_metadata',
        'skill_raw_files',
        'skill_install_snapshots'
      )
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      policy_rec.policyname,
      policy_rec.tablename
    );
  end loop;
end
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'raw-skills',
  'raw-skills',
  false,
  10485760,
  array['text/markdown', 'text/plain', 'application/octet-stream']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
declare
  policy_rec record;
begin
  for policy_rec in
    select policyname
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        coalesce(qual, '') ilike '%raw-skills%'
        or coalesce(with_check, '') ilike '%raw-skills%'
        or policyname ilike '%raw-skills%'
      )
  loop
    execute format(
      'drop policy if exists %I on storage.objects',
      policy_rec.policyname
    );
  end loop;
end
$$;
