# Project-scoped installed skills

**Milestone:** post-mvp
**Post-MVP #:** 11

**Depends on:** task-8-desktop-provider-scan, task-9-installed-skills-provider-ui

## Goal

Add project-local skill discovery as a separate scope from the v1 global
Installed Skills view.

## Scope

- [ ] Add an explicit project scope model and project selection UX; do not infer
  the project from the app's process working directory.
- [ ] Scan project-local provider paths using the same skills.sh-derived
  registry, `SKILL.md` validation, symlink handling, parsing, deduplication,
  and provider attribution rules as global scanning.
- [ ] Support project-local Universal skills under the project’s canonical
  `.agents/skills` directory and provider-specific project paths.
- [ ] Extend the normalized `PlatformPort` snapshot to distinguish global and
  project scope without conflating or deduplicating skills across scopes.
- [ ] Add scope-aware filters, counts, warnings, and card metadata while
  preserving the existing global behavior.
- [ ] Define refresh behavior when the selected project changes or the project
  is unavailable.
- [ ] Add macOS/Windows Rust tests and shared UI/mock fixtures for project
  scope.

## Out of scope

- Authentication or credential detection.
- Cloud sync of local skills.
- Changing the v1 global-only behavior.

## Done when

- Users can explicitly select a project and browse its valid local skills.
- Global and project skills remain clearly separated.
- Project scope works through the same desktop `PlatformPort` boundary and has
  no effect on the web client’s Download the app state.
