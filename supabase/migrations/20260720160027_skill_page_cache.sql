-- Page cache + audit columns on skill_metadata (content_hash already present).
alter table public.skill_metadata
  add column page_snapshot jsonb,
  add column audits jsonb,
  add column audits_fetched_at timestamptz,
  add column page_scraped_at timestamptz;

comment on column public.skill_metadata.page_snapshot is
  'Sparse structured skills.sh HTML page snapshot (summary, topics, weekly installs, etc.).';
comment on column public.skill_metadata.audits is
  'Cached skills.sh /audit API payload.';
comment on column public.skill_metadata.audits_fetched_at is
  'When audits were last fetched from skills.sh.';
comment on column public.skill_metadata.page_scraped_at is
  'When page_snapshot was last scraped from skills.sh HTML.';

create index skill_metadata_page_scraped_at_idx
  on public.skill_metadata (page_scraped_at nulls first);

-- Daily install history for sparklines / analytics.
create table public.skill_install_snapshots (
  skill_id text not null references public.skill_metadata (skill_id) on delete cascade,
  date date not null,
  installs bigint not null check (installs >= 0),
  primary key (skill_id, date)
);

comment on table public.skill_install_snapshots is
  'Daily install counts per skill; PK (skill_id, date) makes same-day upserts idempotent.';

alter table public.skill_install_snapshots enable row level security;
