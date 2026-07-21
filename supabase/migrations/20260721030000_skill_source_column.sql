-- External non-GitHub origin (skills.sh "Source") separate from GitHub repository.
alter table public.skill_metadata
  add column source text;

comment on column public.skill_metadata.source is
  'External non-GitHub origin shown as Source on skills.sh (e.g. https://open.feishu.cn).';
comment on column public.skill_metadata.repository is
  'GitHub owner/repo when the skill is backed by a repository.';

-- Host/URL values previously stored in repository belong in source.
update public.skill_metadata
set
  source = case
    when repository ~* '^https?://' then repository
    when repository ~* '^[a-z0-9.-]+\.[a-z]{2,}' then 'https://' || repository
    else repository
  end,
  repository = null
where repository is not null
  and (
    repository ~* '^https?://'
    or repository ~* '^[a-z0-9.-]+\.[a-z]{2,}(/|$)'
  );
