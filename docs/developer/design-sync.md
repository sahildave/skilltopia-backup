# Design Sync

Keep [`docs/design/DESIGN.md`](../design/DESIGN.md) aligned with the live CSS
while iterating UI in Chrome Inspect. Runtime values live in CSS; DESIGN.md is
the agent-facing contract (Stitch YAML frontmatter + prose). Do not add a
parallel `tokens.json` or a second design document.

## Sources of truth

| Artifact                              | Role                                                      |
| ------------------------------------- | --------------------------------------------------------- |
| `docs/design/DESIGN.md`               | Only active design doc; structured frontmatter + guidance |
| `src/theme-variables.css`             | Runtime semantic theme values                             |
| `scripts/sync-design.mjs`             | Deterministic color-token sync / drift check              |
| `.claude/skills/sync-design/SKILL.md` | Semantic prose and component pass (`/sync-design`)        |

See [ui-patterns.md](./ui-patterns.md) for Tailwind/shadcn CSS layout.

## Commands

| Command                  | Purpose                                          |
| ------------------------ | ------------------------------------------------ |
| `npm run design:check`   | Fail when derivable frontmatter drifts from CSS  |
| `npm run design:sync`    | Update derivable frontmatter from CSS            |
| `npm run design:watch`   | Watch design CSS files and sync derivable values |
| `npm run dev:all:design` | App (`dev:all`) plus `design:watch`              |

`npm run check:all` runs `design:check` first.

## Workflow

Normal development:

```bash
npm run dev:all
```

Design-focused session (opt-in watcher):

```bash
npm run dev:all:design
```

The watcher is intentionally not part of `dev:all`. It is lightweight, but
keeping it out of the default command avoids a third process and prevents
DESIGN.md edits during non-design work.

After a design pass, invoke `/sync-design`. The watcher (and `design:sync`) only
update values they can derive safely from CSS — primarily colors. The skill
handles typography intent, component rules, layout, accessibility, motion, and
prose.

If the watcher was not running, after stopping the app:

```bash
npm run design:sync
# then invoke /sync-design, review the DESIGN.md diff, and run design:check
```

For quick experiments, wait until the design is settled before syncing.
`design:sync` reads the current CSS when invoked; it does not require the
watcher to have been running.

## Deterministic vs semantic

| Layer         | What it covers                                       | How                               |
| ------------- | ---------------------------------------------------- | --------------------------------- |
| Deterministic | Color (and other script-bound) frontmatter ↔ CSS     | `design:check` / `sync` / `watch` |
| Semantic      | Typography intent, components, spacing, a11y, motion | `/sync-design`                    |

There is no automatic agent on every file save. Deterministic updates are safe
to run unattended; semantic updates need an explicit `/sync-design` invocation
so intent is reviewed rather than guessed.

## Common mistakes

```text
❌ BAD: Create tokens.json or a second design-system markdown file
✅ GOOD: Update theme-variables.css and DESIGN.md (via sync + /sync-design)

❌ BAD: Assume design:watch rewrites prose and component rules
✅ GOOD: Use the watcher for colors; invoke /sync-design for the semantic pass

❌ BAD: Skip design:check before committing UI token changes
✅ GOOD: Rely on check:all (includes design:check) before commit
```

## Related

- [Design System](../design/DESIGN.md) — canonical visual and interaction rules
- [UI Patterns](./ui-patterns.md) — CSS architecture and theming
- [Static Analysis](./static-analysis.md) — quality gates including `check:all`
