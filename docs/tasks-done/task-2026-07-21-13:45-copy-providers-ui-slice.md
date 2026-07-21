# Copy providers: installed-skills UI slice

**Milestone:** mvp  
**Depends on:** task-1-copy-providers-filesystem-slice

## Goal

Deliver the complete desktop UI flow from an installed skill’s overflow menu to provider selection and submission.

## Scope

- [x] Replace per-provider badges with `Universal` plus an aggregated `1 Provider` / `n Providers` badge.
- [x] Exclude providers sharing the Universal directory from counts and destinations.
- [x] Add an accessible hover/focus tooltip listing counted provider names vertically.
- [x] Add `Copy to other providers` to the shared overflow menu used by cards and list rows.
- [x] Add the provider-selection dialog with Available, Already installed, and Other providers sections.
- [x] Implement checked-disabled installed entries, collapsed sections, and `Copy all` limited to Available providers.
- [x] Keep the action desktop-only and exclude Universal, Move to Universal, and drag-and-drop.
- [x] Add model, dialog, badge, and card/list-row interaction tests.

## Done when

- A desktop user can open the same copy dialog from either installed-skill presentation and select exactly the intended destinations.
