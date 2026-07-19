create table public.skill_metadata (
  skill_id text primary key,
  content_hash text not null,
  source_url text,
  repository text,
  install_count bigint check (install_count is null or install_count >= 0),
  raw_storage_prefix text,
  enrichment_required jsonb,
  enrichment_optional jsonb not null default '{}'::jsonb,
  estimated_read_time_minutes integer check (
    estimated_read_time_minutes is null or estimated_read_time_minutes >= 1
  ),
  enriched_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

comment on table public.skill_metadata is
  'Skill metadata and enrichment pointers; raw skill content belongs in Storage.';
comment on column public.skill_metadata.enrichment_required is
  'Canonical required enrichment: primaryGoal, requires, estimatedComplexity, bestFor.';
comment on column public.skill_metadata.enrichment_optional is
  'Optional enrichment fields such as worksWith, outputs, and confidence.';

create index skill_metadata_content_hash_idx
  on public.skill_metadata (content_hash);

create index skill_metadata_missing_enrichment_idx
  on public.skill_metadata (skill_id)
  where enrichment_required is null;

create table public.skill_raw_files (
  skill_id text not null references public.skill_metadata (skill_id) on delete cascade,
  file_path text not null,
  storage_path text not null,
  content_type text not null default 'text/markdown',
  byte_size bigint not null check (byte_size >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (skill_id, file_path)
);

comment on table public.skill_raw_files is
  'Pointers to raw skill files in the private raw-skills Storage bucket.';

alter table public.skill_metadata enable row level security;
alter table public.skill_raw_files enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'raw-skills',
  'raw-skills',
  false,
  10485760,
  array['text/markdown', 'text/plain', 'application/octet-stream']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
