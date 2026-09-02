-- The first delisted index keyed on delisted_at inside `where delisted_at is
-- null`, so every indexed row held the same NULL key — a row-set marker that
-- served no ordering. Key it on page_scraped_at instead, which is what
-- listOldestPageScraped orders by once delisted rows are filtered out.
drop index if exists public.skill_metadata_delisted_at_idx;

create index if not exists skill_metadata_live_page_scraped_at_idx
  on public.skill_metadata (page_scraped_at nulls first)
  where delisted_at is null;

create index if not exists skill_metadata_live_queued_idx
  on public.skill_metadata (skill_id)
  where delisted_at is null and content_hash = '';
