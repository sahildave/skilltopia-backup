# Design Sync Automation Handoff

## Goal

Keep the agent-facing design contract in
[`docs/design/DESIGN.md`](./design/DESIGN.md) aligned with the live CSS while
the UI is being iterated quickly through Chrome Inspect.

## Current implementation

- `docs/design/DESIGN.md` is the only active design document.
- Its YAML frontmatter contains Stitch-compatible machine-readable tokens.
- `src/theme-variables.css` is the runtime source for semantic theme values.
- `scripts/sync-design.mjs` provides deterministic token synchronization.
- `.claude/skills/sync-design/SKILL.md` provides the semantic agent workflow.
- `npm run design:check` detects derivable token drift.
- `npm run design:sync` updates derivable frontmatter values.
- `npm run design:watch` watches the design CSS files and syncs derivable values.
- `npm run check:all` includes `design:check`.
- `npm run dev:all:design` starts the app and watcher together.

## Recommended daily workflow

For normal development:

```bash
npm run dev:all
```

For a design-focused session:

```bash
npm run dev:all:design
```

The watcher is intentionally opt-in. It is lightweight, but keeping it out of
the default command avoids an unnecessary third process and prevents design
documentation from being edited during non-design work.

After a design pass, invoke `/sync-design`. The watcher only handles values it
can derive safely from CSS, primarily colors. The skill handles typography
intent, component rules, layout, accessibility, motion, and prose.

If the watcher was not running, use this manual end-of-session workflow after
stopping `npm run dev:all`:

```text
1. Run npm run design:sync
2. Invoke /sync-design
3. Review the DESIGN.md diff
4. Run npm run design:check
5. Run npm run check:all before committing
```

For quick experiments, wait until the design is settled before running the
manual sync. `design:sync` scans the current CSS when invoked; it does not
require the watcher to have been running during the session.

## Important limitation

The current setup does not automatically spawn a separate AI agent on every
file save. It performs safe deterministic updates and requires an explicit
`/sync-design` invocation for semantic changes. A future agent may add an
external Codex/agent runner, but that needs loop prevention, approval policy,
and a clear model invocation contract before it should run automatically.

## Verification

The current implementation has passed:

- `npm run design:check`
- `npm run check:all`
- YAML frontmatter validation
- Node syntax validation
- Prettier and `git diff --check`

## Next possible improvements

1. Extend `sync-design.mjs` to compare typography and radius values, not only
   color values.
2. Add a CI-only design-doc diff report for semantic changes.
3. If true automatic agent invocation is desired, design a guarded external
   runner rather than invoking an agent directly from `fs.watch`.
