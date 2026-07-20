# UI first pass plan

**Milestone:** product-ui-quality

**Depends on:** task-9-installed-skills-provider-ui

## Goal

Make the Skills Manager workspace feel like one coherent product UI after the
provider-detection work lands: clear navigation, predictable installed-skill
filters, tidy discovery rails, accessible states, and design-system alignment
between implementation and `docs/design/DESIGN.md`.

This is a first pass, not a full redesign. Preserve the quiet monochrome system
and improve trust, hierarchy, density, and task flow where the current surfaces
feel provisional.

## Product scene

A developer opens the app in a desktop window while deciding which agent skills
are already available, which provider owns them, and what to install next. The
interface should stay calm under repeated use: scan, filter, compare names,
open details, install, rescan, and recover from partial filesystem access.

## First-pass findings

- The existing design contract is strong and appropriate for a product tool:
  neutral OKLCH tokens, restrained color, shadcn primitives, and desktop shell
  conventions.
- `src/components/skills-manager/SkillsLibraryView.tsx` currently reads as a
  rough spike: header layout is malformed, copy is partly hardcoded, the action
  hierarchy is unclear, and the installed entries are rendered as a fixed
  three-column card grid.
- `src/components/skills-manager/SkillsDashboardView.tsx` has useful discovery
  behavior, but repeated cards, animated rail entrances, and horizontal overflow
  need a tighter product treatment before the app feels dependable.
- `src/components/skills-manager/SkillsSidebar.tsx` needs polish: the brand mark
  area is under-specified, disabled Review creates awkward layout pressure, icon
  sizing bypasses shadcn icon rules, and labels are hardcoded.
- `SkillDetailDialog` is functional, but the detail hierarchy can be more
  scannable with a clearer summary region, metadata rhythm, and footer action.
- `$impeccable` now runs from the loaded skill path at
  `/Users/indhuja/.agents/skills/impeccable`; it reports `NO_PRODUCT_MD`, so
  this scoped UI pass should continue from the existing code and design docs.

## Scope

- [ ] Optionally run `$impeccable init` later to capture `PRODUCT.md`; do not
      block this scoped first pass on it.
- [ ] After task-9 lands, reshape Installed Skills into a provider-first
      product surface: header, provider filter subsection, scan status, Rescan
      action, warning placement, and empty states.
- [ ] Replace the current installed local-card spike with a denser list/card
      hybrid that supports alphabetical scanning, provider tags, counts, and
      stable long-name truncation.
- [ ] Tighten Explore rails: reduce repeated card visual weight, make search
      results and discovery rails share one card vocabulary, keep stale results
      visible during refresh, and avoid page-load choreography.
- [ ] Normalize sidebar composition: clear app identity, primary nav rows,
      disabled/future items, settings placement, focus states, and i18n strings.
- [ ] Polish skill detail hierarchy: summary first, metadata grouped for scan,
      related skills as a compact selectable list, and a consistent external
      action.
- [ ] Verify all text uses i18n, semantic tokens, `cn()` for conditionals,
      shadcn composition, comfortable hit targets, and visible focus states.
- [ ] Check light and dark mode contrast for muted copy, badges, empty states,
      disabled controls, and destructive warnings.
- [ ] Run `npm run design:sync`, invoke `/sync-design` for the semantic prose
      pass, run `npm run design:check`, and update `docs/design/DESIGN.md` only
      if the implementation changes the design contract.
- [ ] Run `npm run check:all` once the runtime is fixed.

## Out of scope

- New provider-scan behavior beyond the contracts in tasks 7-10.
- Project-local skill scanning.
- Compare Skills, AI chat, hidden-gems growth rails, analytics, or auth.
- New visual identity, new palette, custom illustration, gradients, or large
  motion systems.
- Persistent filter storage.

## Done when

- Installed Skills is usable as the primary MVP surface for provider browsing
  and scan recovery.
- Explore and Installed Skills share one coherent component vocabulary.
- Empty, loading, partial-warning, error, and web-unavailable states each give
  one clear next action.
- Light and dark modes pass contrast checks for body, muted, and control text.
- The design contract and CSS implementation have no drift according to the
  design sync/check flow.
- `npm run check:all` passes, or any remaining failure is documented with an
  owner and next command.
