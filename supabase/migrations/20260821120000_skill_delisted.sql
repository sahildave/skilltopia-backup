-- Tombstone for skills skills.sh no longer serves (detail 404).
-- Without this a 404 leaves content_hash = '' forever, so the skill stays in
-- the detail queue, is re-attempted every run, and keeps the ingest exit code
-- non-zero. Delisting is deliberate and sticky: clear the column by hand if a
-- skill genuinely comes back, otherwise a re-sighting would just re-404.
alter table public.skill_metadata
  add column if not exists delisted_at timestamptz;

comment on column public.skill_metadata.delisted_at is
  'Set when skills.sh returned 404 for the skill detail; excluded from rotation.';

create index if not exists skill_metadata_delisted_at_idx
  on public.skill_metadata (delisted_at)
  where delisted_at is null;
