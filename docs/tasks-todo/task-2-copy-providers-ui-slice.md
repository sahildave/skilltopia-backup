# Copy providers: installed-skills UI slice

**Milestone:** mvp  
**Depends on:** task-1-copy-providers-filesystem-slice

## Goal

Deliver the complete desktop UI flow from an installed skill’s overflow menu to provider selection and submission.

## Scope

- [ ] Replace per-provider badges with `Universal` plus an aggregated `1 Provider` / `n Providers` badge.
- [ ] Exclude providers sharing the Universal directory from counts and destinations.
- [ ] Add an accessible hover/focus tooltip listing counted provider names vertically.
- [ ] Add `Copy to other providers` to the shared overflow menu used by cards and list rows.
- [ ] Add the provider-selection dialog with Available, Already installed, and Other providers sections.
- [ ] Implement checked-disabled installed entries, collapsed sections, and `Copy all` limited to Available providers.
- [ ] Keep the action desktop-only and exclude Universal, Move to Universal, and drag-and-drop.
- [ ] Add model, dialog, badge, and card/list-row interaction tests.

## Done when

- A desktop user can open the same copy dialog from either installed-skill presentation and select exactly the intended destinations.
