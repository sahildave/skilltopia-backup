# Repo owner avatar on catalog skill card

**Milestone:** mvp  
**Depends on:** catalog skill cards + `SkillsShSkill.source` (done)

## Goal

Show the **repo owner’s avatar** next to the repo name (`skill.source`) on catalog skill cards so ownership is scannable at a glance.

## Context

- Catalog cards render in `CatalogSkillCard` (`src/components/skills-manager/CatalogSkillCard.tsx`).
- The subtitle today is plain text `{skill.source}` (typically `owner/repo`).
- `SkillsShSkill` has `source`, `sourceType`, and `id` (`owner/repo/skill`); there is no avatar field.
- For GitHub-backed skills, the owner is the first path segment of `source` (or of `id` when `source` is missing/non-repo).
- GitHub serves public avatars at `https://github.com/{owner}.png` — no Backend secret or scrape required.
- Prefer existing shadcn `Avatar` (or a small `<img>` matching card density) over `DitherAvatar` unless product asks for dithered treatment.

## Scope

### Helper

- [ ] Add a small pure helper (e.g. `ownerAvatarUrl(source, sourceType?)`) that returns a GitHub avatar URL when the source looks like `owner/repo`, otherwise `null`.
- [ ] Unit tests for valid GitHub-shaped sources, non-GitHub / URL sources, and empty/malformed input.

### UI

- [ ] In `CatalogSkillCard`, place a small circular avatar immediately before the `skill.source` subtitle (and keep the compact card variant consistent).
- [ ] Hide the avatar (or show a neutral fallback) when the helper returns `null` or the image errors.
- [ ] Keep morphing-dialog title/subtitle layout intact; avatar must not break truncate/line-clamp.
- [ ] Treat the image as decorative when the owner name is already visible in `source` (empty `alt`, or label via existing text).

### Out of scope

- Installed library `SkillCard` (no repo name row).
- Persisting avatar URLs in Supabase / scrape pipeline.
- Skill detail dialog header (follow-up if desired).
- Non-GitHub host avatar APIs.

## TDD seams

- Helper unit tests (parse + URL construction).
- `CatalogSkillCard` / dashboard tests: avatar `src` present for a GitHub `source`; absent for non-repo `source`.

## Done when

- Catalog cards show owner avatar next to `skill.source` for GitHub-shaped sources.
- Non-GitHub / unknown sources degrade cleanly (no broken image chrome).
- `npm run check:all` passes.
