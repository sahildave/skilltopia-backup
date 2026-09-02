# AFK epic #1 — handoff, 2026-08-20

The unattended run on
epic #1 (backup-repo issue; repo consolidated into `sahildave/skilltopia`, Sept 2026 — see `docs/archive/backup-repo/README.md`) is **halted by the
circuit breaker**, not finished. This is what landed, what broke, and the exact commands to
pick it back up.

Branch: `feat/1-skill-lifecycle-rearchitecture` · PR
#16 (backup-repo PR, archived off-GitHub at consolidation) · `max_parallel: 2`

## Where each task stands

| Task                               | Status               | What it needs                                                         |
| ---------------------------------- | -------------------- | --------------------------------------------------------------------- |
| #2 Seam A — absolute Node/npx path | `integration_failed` | reset and requeue; its failure was the base, not the code             |
| #3 reconcile universal skills dir  | `integration_failed` | reset — its branch carries a bad symlink, see below                   |
| #4 Seam B — path classifier        | **passed**           | merged at `e1a7691`, nothing owed                                     |
| #5 Seam C — acquisition + cache    | `pending`            | never finished; first builder hit the agent deadline                  |
| #6 Seam D — projection             | `blocked`            | unblocks when #3 and #5 pass                                          |
| #7 Seam E — desktop adapter port   | `blocked`            | via #6                                                                |
| #8 packaged `.app` acceptance      | `blocked`            | via #7, and it is `gate: after` — a human accepts it, no builder runs |

`npm run check:all` is **green** on the branch as of this commit: 57 Rust tests, clean
clippy, clean prettier.

## The two failures, both infrastructure

Neither was a bad ticket. Both poisoned every lane identically, which is what tripped the
"2 tasks failed in a row" breaker.

**1. A shared cargo target directory.** `worktreeSetup.link` included `src-tauri/target`
so lanes would not each pay a cold Tauri build. Two things went wrong. A lane cleaned the
shared directory — which is the _real_ one in the main checkout — and the next worktree
bootstrap threw `worktreeSetup.link: src-tauri/target does not exist` and killed the runner
mid-integration. Separately, `src-tauri/.gitignore` ignored `/target/` with a trailing
slash, which matches a **directory** and not a **symlink of the same name**, so the link
itself got committed onto `afk/task-3`. Cargo cannot create its build directory on that
branch, so `check:all` fails there and only there.

Fixed in `5a8685f` (target is no longer linked; lanes pay their own Rust build) and in this
commit (the ignore now covers the symlink form too). `afk/task-3` still carries the bad
commit and must be reset rather than salvaged.

**2. The runner's own `docs/progress.md`.** `afk` rewrites that file as an unaligned
markdown table on every status update, and `prettier --check .` rejects it — so `check:all`
would have failed for **every** lane in this epic, forever, on a file no task touched. The
supervisor diagnosed this correctly and unprompted. Fixed at `e7aea10`: `docs/progress.md`
is in `.prettierignore`.

#2 failed only for this reason. Its code was never the problem.

## Resume

```bash
# 1. requeue the three lanes that owe work
afk reset 2 3 5

# 2. restart; #4 stays passed, #6/#7/#8 recompute behind the resets
afk epic 1

# 3. at the very end, #8 is gate: after — no builder ever runs it
afk epic 1 --accept=8

# 4. then close out; this prunes lane worktrees and prints the gh pr merge command
afk finish
```

`afk reset` refuses while the scheduler owns runtime state, so do it with the run stopped.

## Open decisions for whoever picks this up

- **Plan review flagged `scope_overlap [#2 → #7]` and it was never applied.** Both rewrite
  the same `Command.create('npx')` calls in `src/platform/index.desktop.ts`, and nothing
  currently stops them running concurrently. Adding `2` to `#7`'s `depends_on` in the epic's
  `afk:` block costs no wall-clock, since #7 already sits at depth 2. Recorded at
  `.afk/plan-review/1/decisions.md`.
- **Depth 3 is the structural risk the validator warned about.** #3 alone strands #6, #7 and
  #8 — three of seven. Future epics against this repo want wider and shallower slicing.
- **#5 hit the agent deadline** (`agent.timeoutMs: 900000`) on its first attempt. If it does
  it again, the ticket is too big for one lane rather than the timeout being too short.
- **#8's ticket mentions `.claude/skills`**, which builders may not edit. Harmless if it is
  only a pointer; if the work genuinely needs that edit, no lane can do it and the ticket
  needs rewriting or an entry in `protectedEdits`.

## Repo changes this run required

Committed to `main` before the run could start, and to the epic branch during it:

- `79ed529` — `worktreeSetup`, ignore `.afk/`, mark `runs/**` linguist-generated
- `fa0beb8` — a prettier pass; `main` was already failing `format:check` on `README.md`,
  `src-tauri/tauri.conf.json` and the audit report, which aborted the first start
- `5a8685f` — stop sharing `src-tauri/target` across lane worktrees
- `e7aea10` — exclude the runner's `docs/progress.md` from prettier (written by integrator 4)

`passed` on #4 means `check:all` went green. Nobody has reviewed that code. The closeout
verifier is advisory and runs when the epic stops.
