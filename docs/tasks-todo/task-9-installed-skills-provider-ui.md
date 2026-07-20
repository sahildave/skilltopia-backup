# Installed Skills provider filters

**Milestone:** provider-detection

**Depends on:** task-8-desktop-provider-scan, task-4-shippable-web-mvp

## Goal

Turn the existing Library surface into an Installed Skills view with provider
filters, Universal grouping, local skill cards, and the agreed web/mock
behavior.

## Scope

- [ ] Rename the Library tab to **Installed Skills**.
- [ ] Add a Providers sidebar subsection with Universal first, active providers
  visible, and inactive registry providers in a collapsed searchable group.
- [ ] Show provider skill counts, warning indicators, and the configured global
  skills directory path. Make the path clickable through `PlatformPort` to
  reveal it in Finder/Explorer where supported.
- [ ] Keep Universal visible even when empty; show contextual content-area
  warnings for empty or partial scans.
- [ ] Make All Agents the default selection on app start; preserve selection
  during same-session navigation and reset it on app restart.
- [ ] Render All Agents as one alphabetical, deduplicated list with stable
  provider tags such as `[Universal]` and `[Claude Code]`.
- [ ] Keep same-name skills as one card even when copies differ; merge provider
  tags and retain source-path details in the normalized scan data for future
  inspection without showing paths on the card.
- [ ] Render a selected non-Universal provider from only its direct filesystem
  directory.
- [ ] Add an off-by-default **Show all Universal** switch only to selected
  non-Universal provider views. Reset it when the tab is reopened or provider
  selection changes. When enabled, append a separate **Universal Skills**
  section below the provider’s direct skills.
- [ ] Keep previous results visible with a subtle refresh indicator during
  rescans; do not block provider clicks on a new scan.
- [ ] Automatically refresh on Installed Skills tab activation and provide a
  manual Rescan action.
- [ ] Use the shared platform port only; shared UI must not import Tauri APIs.
- [ ] On web, replace filesystem-based Installed Skills with the Download the
  app state. Keep the provider UI available through the mock adapter for Chrome
  UI development.
- [ ] Add i18n strings for labels, warnings, empty states, toggle copy, and
  provider path/reveal affordances.

## Out of scope

- Project-local skills.
- Provider detail routes.
- Authentication status.
- Multi-select filters.
- Persistent filter or scan-result storage.
- Source-attribution modal/overflow placement.

## Done when

- Desktop users can browse and filter valid global skills by provider.
- Universal and provider associations are visible on cards without showing a
  filesystem path on every card.
- Web production contains no Tauri markers and shows the acquisition state.
- Mock fixtures exercise Universal-only, provider-only, duplicate, empty, and
  warning states.
