# Installed skills: copy to providers MVP

**Status:** Done (2026-07-21)

**Context:** Follow-up to the installed-skills provider UI and desktop provider
scan work. This document captures the decisions made during the grilling
session on 2026-07-21.

## Goal

Let users copy an installed skill to additional providers from the skill card
or list-row overflow menu. Copying creates a symlink in each selected provider
folder, using the skill's original folder as the symlink target.

## Product decisions

### Provider badges

- Installed skills use only two badge types:
  - `Universal` when the skill is present in the Universal directory.
  - `1 Provider` / `n Providers` for non-Universal provider associations.
- A skill may show both badges. For example: `Universal` + `1 Provider`.
- Hovering the `n Providers` badge shows the provider names in a vertical list.
- Do not render one badge per provider.

### Overflow actions

- Add `Copy to other providers` to the overflow menu for installed skills.
- Copy is available even when the current provider entry is already a symlink.
  Resolve the original target and create new symlinks from that folder.
- `Move to universal` is explicitly out of scope for this MVP.
- Dragging a card/list row into the sidebar is optional polish and should not
  block the MVP.

### Copy dialog

The dialog is a provider-selection dialog, not an editor for existing
installations.

Sections, in order:

1. **Available providers**
   - Providers shown in the primary/active provider area of the sidebar.
   - Only providers where the skill is not installed appear here.
   - Each provider has a selectable checkbox.
   - A `Copy all` select-all checkbox selects only this section.
2. **Already installed**
   - Collapsed by default.
   - Contains every provider where the skill is already installed.
   - Entries are checked and disabled.
3. **Other providers**
   - Collapsed by default, using the sidebar's inactive-provider treatment.
   - Entries have selectable checkboxes.
   - They are not included by `Copy all`; users select them individually.

Universal should not be a copy destination. It is the canonical source
location and is represented separately by the `Universal` badge.

The dialog footer should summarize the requested work, for example:
`Copying to 2 providers.` If no provider is selected, the submit action should
be unavailable.

### Filesystem behavior

- Copying creates a directory symlink in every selected target provider folder.
- If a selected provider's skills folder does not exist, create the required
  parent folder before creating the symlink.
- Never overwrite an existing target path. If a same-named folder or unrelated
  symlink already exists, leave it untouched and report that provider as a
  conflict/failure.
- Multiple targets are independent operations. If some copies succeed and one
  fails, keep the successful copies and report the failed provider(s).
- After the operation, rescan installed skills so badges, counts, and sidebar
  state update from filesystem truth.

## Existing repository contracts to reuse

- `ScannedSkill.providerIds` identifies Universal and provider associations.
- `ScannedSkill.paths` contains each scanned entry and `originalPath` when the
  entry is a symlink.
- The Rust scanner already accepts directory symlinks and preserves their
  resolved targets.
- Provider definitions and target directory resolution come from the bundled
  provider registry.
- The desktop platform boundary is `PlatformPort` in
  `src/platform/types.ts`; filesystem mutation belongs behind this boundary,
  implemented by a typed Tauri command rather than direct React filesystem
  access.
- The sidebar model already distinguishes active providers from inactive
  providers and should be the source for the dialog's provider grouping.

## Suggested implementation shape

1. Add a typed platform operation for copying one skill to selected providers.
2. Implement safe target validation, directory creation, symlink creation, and
   per-provider result reporting in Rust.
3. Add dialog state and provider grouping in the skills-manager components.
4. Replace the current per-provider badge rendering with the two-badge model
   and hover provider list.
5. Add overflow-menu actions to both `SkillCard` and `SkillListRow` through
   their shared `SkillCardOverflowMenu`.
6. Rescan after a successful or partial operation and show a concise toast with
   successes, conflicts, and failures.
7. Add Rust and React tests for grouping, badge output, symlink creation,
   missing-folder creation, conflicts, and partial success.

## Explicitly out of scope

- Moving a real provider folder into Universal.
- Removing an existing provider installation through the copy dialog.
- Copying to Universal.
- Project-local skill copies.
- Drag-and-drop unless it is trivial after the core flow is complete.
