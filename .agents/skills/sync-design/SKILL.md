---
name: sync-design
description: Reconcile docs/design/DESIGN.md with the current CSS design implementation after Chrome Inspect or UI changes. Use for design-system updates, token drift, typography changes, spacing changes, component styling changes, or motion changes.
user-invocable: true
allowed-tools: [Read, Bash, Glob, Edit]
---

# Sync Design System

Keep `docs/design/DESIGN.md` as the single agent-facing design source. Never
create a second token file or a reference copy.

## Workflow

1. Read `docs/design/DESIGN.md`, `src/theme-variables.css`, `src/App.css`,
   `src/quick-pane.css`, and the changed UI files.
2. Run `npm run design:sync` to reconcile frontmatter values that can be
   derived deterministically from the CSS source.
3. Update the Markdown prose in `DESIGN.md` when the change affects visual
   intent, component behavior, spacing, typography, accessibility, responsive
   behavior, or motion.
4. Keep the Stitch YAML frontmatter and prose consistent. Frontmatter is the
   structured design contract; prose explains how to apply it.
5. Run `npm run design:check` and `git diff --check`.

## Guardrails

- Do not overwrite intentional design decisions just because an unrelated CSS
  value differs; inspect the change and update the design contract deliberately.
- Use semantic token names and preserve the existing Tailwind/shadcn patterns.
- Keep runtime values in `src/theme-variables.css`; do not add a parallel
  `tokens.json` or duplicate design document.
- If the source change is ambiguous, report the mismatch and ask for a design
  decision instead of guessing.

## Useful commands

- `npm run design:check` — fail when derivable CSS tokens drift from `DESIGN.md`.
- `npm run design:sync` — update derivable frontmatter tokens and print the
  remaining semantic pass.
- `npm run design:watch` — watch CSS/design files and sync derivable tokens as
  they change during Chrome Inspect work.
