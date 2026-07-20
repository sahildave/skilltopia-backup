---
version: alpha
name: Skills Manager Workspace
description: A quiet, high-clarity interface system for skill discovery, agent workflows, and connected tools.
colors:
  primary: '#171717'
  on-primary: '#FAFAFA'
  surface: '#FFFFFF'
  surface-subtle: '#F5F5F5'
  surface-muted: '#F5F5F5'
  on-surface: '#171717'
  on-surface-muted: '#737373'
  border: '#E5E5E5'
  border-strong: '#D7D7D7'
  accent: '#F5F5F5'
  accent-soft: '#EAF4FF'
  accent-warm: '#E97855'
  on-accent: '#171717'
  success: '#20C878'
  warning: '#F4B400'
  error: '#DF2225'
  info: '#7D6CF0'
  dark-canvas: '#171717'
  dark-surface: '#171717'
  dark-surface-raised: '#222222'
  dark-on-surface: '#FAFAFA'
  dark-on-surface-muted: '#A6A6A6'
  dark-border: '#2B2B2B'
typography:
  display:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif"
    fontSize: 48px
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: -0.035em
  h1:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif"
    fontSize: 32px
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: -0.025em
  h2:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif"
    fontSize: 24px
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: -0.02em
  h3:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif"
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.3
  caption:
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
  mono:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
rounded:
  none: 0px
  sm: 8px
  md: 14px
  lg: 22px
  xl: 30px
  pill: 999px
spacing:
  1: 4px
  2: 8px
  3: 12px
  4: 16px
  5: 20px
  6: 24px
  8: 32px
  10: 40px
  12: 48px
  16: 64px
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.on-primary}'
    typography: '{typography.label}'
    rounded: '{rounded.pill}'
    height: 44px
  button-accent:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.on-accent}'
    typography: '{typography.label}'
    rounded: '{rounded.pill}'
    height: 44px
  input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.on-surface}'
    typography: '{typography.body}'
    rounded: '{rounded.lg}'
  card:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.on-surface}'
    typography: '{typography.body}'
    rounded: '{rounded.lg}'
---

# Skills Manager Workspace Design System

This is the canonical design guidance for UI work in this repository. It is
written for both human developers and AI coding agents. Read it together with
[`docs/developer/ui-patterns.md`](../developer/ui-patterns.md), which defines
the Tailwind, shadcn/ui, OKLCH, and desktop behavior already used by the app.

This is the only active design document. Its YAML frontmatter is the
machine-readable design contract; the prose explains how to apply it. Live
runtime values belong in [`src/theme-variables.css`](../../src/theme-variables.css),
which must implement these tokens rather than introduce parallel values.

## Overview

Build a quiet, high-clarity workspace for discovering skills, moving between
agents and tools, and acting on one clear task at a time. The interface should
feel calm, capable, precise, and quietly premium. Let hierarchy come from
scale, whitespace, typography, and surface contrast before using color.

Avoid a noisy dashboard, neon sci-fi styling, decorative card piles, and
competing visual treatments. Generated content and the user's next action
should remain more prominent than the shell.

### Repository constraints

- Use semantic tokens from `src/theme-variables.css`; do not introduce raw
  light/dark colors in component classes.
- Use Tailwind CSS v4 and shadcn/ui components. Prefer existing primitives in
  `src/components/ui/` and compose them in feature folders.
- Shared UI must work in both web and desktop targets. Import platform behavior
  through `@platform` and `@catalog`; do not import Tauri APIs into shared UI.
- Preserve the app's desktop conventions: default arrow cursor, selectable
  text only in editable/content regions, no body overscroll, and hidden body
  overflow where the shell owns scrolling.
- Use CSS logical properties and existing i18n patterns for user-facing text.
- Use `cn()` for conditional classes and accept `className` on reusable layout
  components.

## Colors

The current implementation uses shadcn semantic names backed by OKLCH values.
The conceptual roles below describe when to use them; the implementation values
are in [`src/theme-variables.css`](../../src/theme-variables.css).

| Role                             | Use                                         | Avoid                              |
| -------------------------------- | ------------------------------------------- | ---------------------------------- |
| `background` / `foreground`      | Main canvas and primary reading text        | Per-component raw colors           |
| `card` / `card-foreground`       | Grouped content surfaces                    | Turning every row into a card      |
| `muted` / `muted-foreground`     | Supporting copy and quiet controls          | Low-contrast small text            |
| `primary` / `primary-foreground` | The strongest action in a region            | Multiple competing primary actions |
| `accent` / `accent-foreground`   | Selected states and focused product moments | Ordinary control backgrounds       |
| `border` / `input` / `ring`      | Structure, fields, and keyboard focus       | Heavy outlines and stacked shadows |
| `destructive`                    | Destructive actions and error states        | General-purpose emphasis           |

Use a near-monochrome foundation. Saturated cyan, blue, violet, pink, orange,
or yellow belong in compact status indicators or bounded artwork, never as a
global page gradient.

## Typography

Use the existing system sans stack for product UI. Keep headings confident but
moderately weighted, with tight tracking; keep body copy readable and
breathable. Use monospace only for commands, paths, identifiers, and code.

| Role    | Size |  Weight | Use                                   |
| ------- | ---: | ------: | ------------------------------------- |
| Display | 48px | 500–600 | Rare entry or marketing-like surfaces |
| H1      | 32px | 500–600 | View title                            |
| H2      | 24px | 500–600 | Major section                         |
| H3      | 18px | 500–600 | Subsection or card title              |
| Body    | 16px |     400 | Product copy                          |
| Label   | 14px |     500 | Actions, navigation, metadata         |
| Caption | 12px |     400 | Supporting details                    |
| Mono    | 13px |     400 | Code and technical values             |

## Layout

- Use the 4px spacing base, with common jumps of 8, 16, 24, 32, and 48px.
- Use generous whitespace around empty states and primary prompts.
- Keep application content left-aligned within the shell; center empty states
  and focused setup panels when that improves the next-action hierarchy.
- Use the existing shell structure: title bar or web shell, navigation rail or
  sidebar, main content, optional right sidebar, and global overlays.
- Use 1px quiet dividers and surface shifts before shadows.
- Use small radii for compact blocks, medium radii for navigation rows, large
  radii for cards/composers, and pills for actions, chips, and badges.
- Maintain the same geometry across light and dark themes; change surfaces,
  borders, and text tokens rather than redesigning the interaction model.

## Components

### Actions

Use one strongest action per region. Use shadcn buttons with semantic tokens;
primary actions may use the neutral primary treatment or the blue accent when
the action needs extra signal. Hover and focus should change tone or ring
visibility without shifting layout. Disabled controls must remain readable.

### Navigation

Navigation is text-led and icon-supported. Selected items use a quiet filled
surface or capsule, not a loud gradient. Keep navigation density moderate and
preserve the existing sidebar state behavior.

### Inputs and composers

Inputs should have a clear border, generous padding, readable placeholder
contrast, and an obvious focus ring. A composer may be larger and rounded, but
it should still expose one clear next action and preserve text selection.

### Cards, lists, and overlays

Cards group a meaningful task or content unit; do not wrap every item in one.
Use hairlines for continuous lists. Dialogs and popovers may use a soft,
low-opacity shadow and backdrop dimming, but the application shell should stay
flat and quiet.

Installed skills should favor dense, alphabetically scannable rows with compact
provider and kind badges. Discovery rails and search results should share the
same restrained card vocabulary and keep existing results visible during
refreshes instead of using page-load choreography.

### Motion and Materials

Interaction feedback should be immediate and modest. Pressable controls use a
120ms transform/opacity response that never changes layout; larger overlay
movement stays under 220ms and uses only opacity and transform. Command palette
motion is anchored above the workspace, preferences motion is anchored toward
the sidebar, and skill details rise from the content area so enter and exit
paths remain spatially predictable.

Translucent sticky chrome and modal surfaces use semantic background tokens
with blur as a material cue. Sticky headers separate from scrolled content with
a soft scroll-edge fade instead of a hard divider. Respect
`prefers-reduced-motion` by replacing slide/zoom/pulse motion with short
opacity-only transitions, `prefers-reduced-transparency` by making material
layers solid, and `prefers-contrast: more` by restoring crisp separators.

### Artwork and effects

Aurora-like gradients, logos, and illustrations are optional bounded media
layers. Prefer CSS or optimized raster assets. Do not add Canvas, WebGL,
shaders, particles, parallax, or cursor effects unless a requirement explicitly
calls for them. Every animated artwork treatment needs a static, usable
fallback. Motion should be short and explanatory: roughly 120ms micro,
220ms normal, and 420ms macro transitions with small opacity/translation
changes.

### Accessibility and interaction

- Keep text combinations at WCAG AA contrast, especially muted labels.
- Preserve visible keyboard focus; never rely on color alone for state.
- Keep hit targets comfortable and labels specific and verb-led.
- Respect reduced-motion preferences when adding transitions.
- Keep errors plainspoken, calm, and actionable.
- Make empty states sparse and give the user one obvious next step.

## Do's and Don'ts

Do use whitespace as structure, semantic tokens, restrained borders, consistent
radii, and one clear focal task. Do follow the existing component and platform
patterns before introducing a new primitive.

Don't use raw `bg-white`, `text-gray-*`, or hardcoded light/dark values. Don't
add gradients to ordinary controls. Don't reduce muted text below accessible
contrast. Don't introduce a desktop-only interaction into shared web UI. Don't
let decorative imagery overpower the task or generated content.

### Provenance and confidence

The visual direction was distilled from the original screenshot references.
Values inferred from screenshots are guidance, not proof of a required
implementation. When this document conflicts with the actual repository
architecture or `src/theme-variables.css`, the repository's implementation
patterns win and this document should be updated.

### Keeping the design current

When changing primary colors, typography, radii, spacing, or motion:

1. Update the live implementation in `src/theme-variables.css` or the relevant
   shared CSS/component pattern.
2. Update the corresponding guidance in this document in the same change.
3. Remove obsolete values from code comments or feature docs rather than
   preserving a second token table.
