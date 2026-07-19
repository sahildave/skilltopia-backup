# Native Edit menu for text field shortcuts

**Epic:** Desktop polish  
**Milestone:** mvp  
**Depends on:** none

## Goal

Restore macOS (and Windows/Linux) text-editing shortcuts in focused inputs — especially dashboard search — by adding a native **Edit** app menu with Tauri `PredefinedMenuItem`s.

## Problem

Without an Edit menu, WKWebView does not receive system edit accelerators. ⌘A (Select All) and related shortcuts fail in inputs even though the React search field is a normal controlled `<input>`.

## Scope

- [x] Add Edit submenu to `buildAppMenu()` in `src/lib/menu.ts` (Undo, Redo, Cut, Copy, Paste, Select All)
- [x] Place Edit between App and View menus
- [x] Add `menu.edit` i18n keys (en / fr / ar)
- [x] Update `docs/developer/menus.md` structure

## Out of scope

- Custom React search component / shadcn replacement
- Per-input `keydown` hacks for ⌘A
- Changing context menus (already have Select All)

## Done when

- Focus dashboard search → ⌘A / Ctrl+A selects all text
- Cut / Copy / Paste / Undo / Redo work in text fields via menu accelerators
- ⌘⌫ delete-to-start behaves as expected in inputs (verify after Edit menu; only add input fallback if still broken)
