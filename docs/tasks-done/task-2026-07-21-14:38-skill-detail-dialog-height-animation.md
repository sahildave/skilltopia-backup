# Skill detail dialog height animation after content load

**Milestone:** polish  
**Depends on:** MorphingDialog + SkillDetailBody (done)

## Goal

When the Explore skill detail dialog opens and detail/audits finish loading, the **dialog height should ease** to the new size instead of snapping.

## Context

- Cards open detail via `MorphingDialog` in `CatalogSkillCard` / `CatalogSkillListRow`.
- Body is `SkillDetailBody` (`SkillDetailDialog.tsx`): compact loading spinner → full content (and audits loader → list).
- `MorphingDialogContent` has shared `layoutId` for open/close morph but no `layout` for post-open size changes.
- Motion tokens live in `src/lib/animation.ts` (`layoutDuration`, `entranceEase`, opacity helpers). Prefer Motion `layout` (FLIP) over raw `height: 'auto'` on the shell.
- Follow `/mastering-animate-presence` for the loading ↔ content swap (`AnimatePresence`, exit, keys, `popLayout`).

## Scope

- [x] Enable `layout` on `MorphingDialogContent` (respect `useReducedMotion`: no layout motion when reduced).
- [x] Wrap `SkillDetailBody` loading / error / ready swap in `AnimatePresence` (`mode="popLayout"`, stable keys, opacity enter/exit using animation tokens).
- [x] Keep open/close `layoutId` morph and spring `MORPH_TRANSITION` intact unless feel-check requires a layout-only transition override.
- [x] Audits section: rely on parent `layout` for the secondary jump (no separate expand unless still jarring after primary fix).

### Out of scope

- Changing card → dialog morph spring stiffness/damping.
- Animating other dialogs (preferences, copy providers).
- New motion dependencies.

## TDD seams

- Existing `SkillDetailBody` tests: loading → cached content / uncached still pass.
- `MorphingDialog` open/close/escape tests still pass with `layout` enabled.

## Done when

- Opening a skill on Explore: after detail loads, dialog height animates instead of jumping.
- `prefers-reduced-motion`: size change is instant (or opacity-only); no layout tween.
- Feel-check at 10% playback: height eases; content does not hard-cut without fade.
- `npm run check:all` passes.
