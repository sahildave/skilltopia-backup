# Fluid interface polish

**Milestone:** product-ui-quality

**Depends on:** task-2026-07-20-ui-first-pass-plan

## Goal

Make the Skills Manager workspace feel more physically responsive and native
without turning it into a motion showcase. Use the Apple design pass as the
interaction lens: immediate feedback, spatially consistent overlays,
interruptible-feeling transitions, restrained material layers, and accessible
motion fallbacks.

This task is a craft pass over existing surfaces, not a redesign. Preserve the
quiet monochrome product system in `docs/design/DESIGN.md` and keep shared UI
compatible with both web and Tauri targets.

## Product scene

A developer repeatedly searches, opens details, installs, rescans, and changes
preferences during a working session. The app should feel calm and direct:
controls respond immediately, overlays appear from predictable places, loading
does not erase context, and reduced-motion users still get clear state changes.

## Pass findings

- Most interaction motion currently comes from default shadcn/tw-animate
  classes in primitives like `Dialog`, `CommandDialog`, dropdowns, and sidebars.
  That gives the app a baseline, but not an app-specific motion contract.
- `src/components/ui/dialog.tsx` uses centered zoom/fade behavior for every
  dialog. That is acceptable for generic modal tasks, but the command palette,
  preferences, and skill details should have intentionally tuned entrance,
  exit, focus, and reduced-motion behavior.
- `src/components/skills-manager/SkillsDashboardView.tsx` has a translucent
  sticky search/header layer, but it relies on a hard border and blur without
  reduced-transparency or high-contrast fallbacks.
- `src/components/skills-manager/SkillsSidebar.tsx` and core buttons mostly
  respond through color changes. Primary navigation, icon buttons, install
  actions, and the Rescan shortcut should provide immediate press feedback
  while staying under the 200ms interaction-feedback limit.
- `src/components/preferences/ShortcutPicker.tsx` has a capture state and pulse
  animation, but it needs a more deliberate state transition: instant press
  affordance, clear capture status, no indefinite motion for reduced-motion
  users, and inline validation/error placement if a shortcut is invalid.
- Loading and refresh states are structurally present, but they should preserve
  context during refreshes instead of replacing stable content wherever possible.

## Scope

- [ ] Define a small app-level motion contract in code and docs: default
      overlay timing, press feedback timing, reduced-motion behavior,
      reduced-transparency behavior, and high-contrast material fallback.
- [ ] Tune `Dialog`/`CommandDialog` motion so command palette, preferences, and
      skill details enter and exit along spatially consistent paths using only
      `transform` and `opacity`.
- [ ] Add reduced-motion CSS so large overlay movement becomes a short
      opacity-focused transition with no zoom, slide, elastic, or pulse motion.
- [ ] Add reduced-transparency and increased-contrast fallbacks for translucent
      sticky chrome and modal layers.
- [ ] Replace hard sticky-header separation where appropriate with a subtle
      scroll-edge treatment that does not obscure content and remains legible in
      light and dark themes.
- [ ] Add instant, layout-stable press feedback to primary navigation rows,
      install/dropdown triggers, Rescan, clear-search, details, external-link,
      and settings actions.
- [ ] Polish `ShortcutPicker` capture feedback: pointer-down/click feedback,
      keyboard focus clarity, reduced-motion-safe pending state, and clear
      cancel/confirm behavior.
- [ ] Keep stale search, discovery, and installed-library content visible during
      background refreshes where the data layer already supports it; show local
      status near the initiating control.
- [ ] Verify all icon-only controls keep accessible names and all visible text
      remains in `locales/*.json`.
- [ ] Run `npm run design:sync`, invoke `/sync-design` for the semantic prose
      pass, run `npm run design:check`, and update `docs/design/DESIGN.md` only
      if the implementation changes the design contract.
- [ ] Run `npm run check:all`.

## Out of scope

- New visual identity, color palette, gradients, illustrations, or major layout
  changes.
- Gesture-driven drawers, drag interactions, haptics, audio, or custom physics.
- New dependencies unless existing Tailwind, tw-animate-css, shadcn/Radix, or
  CSS primitives cannot meet the acceptance criteria.
- Backend API, Supabase, skills.sh catalog behavior, installer behavior, or
  provider detection.
- Running a local dev server without the user opting in.

## Done when

- Core app controls visibly respond on press/focus without layout shift.
- Command palette, preferences, and skill detail overlays feel spatially
  consistent and remain keyboard/screen-reader accessible.
- Reduced motion, reduced transparency, and increased contrast preferences have
  explicit fallbacks for changed motion/materials.
- Search, refresh, loading, empty, warning, and error states keep users oriented
  and do not unnecessarily blank stable content.
- `docs/design/DESIGN.md` and `src/theme-variables.css` remain synchronized
  after the design sync/check flow.
- `npm run check:all` passes, or any remaining failure is documented with an
  owner and next command.
