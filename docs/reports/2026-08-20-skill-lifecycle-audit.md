# Skill lifecycle audit — install, copy, uninstall

**Date:** 2026-08-20
**Scope:** the install / copy / uninstall paths in `src/platform/index.desktop.ts`,
`src/platform/install-command.ts`, `src-tauri/src/provider_scan/`.
**Comparison baseline:** [inkeep/open-knowledge](https://github.com/inkeep/open-knowledge)
(`packages/server/src/skill-projection.ts`, `packages/core/src/skills-catalog/`).

All timings below were measured on this machine (M5 Pro, 64 detected providers,
827 SKILL.md files on disk). Harnesses are in `/tmp/skilltopia-dbg/`.

---

## 1. Summary

Three of our four skill operations delegate to `npx skills` as a subprocess.
That single decision is the source of every correctness _and_ performance
finding in this document. Open-knowledge performs the equivalent work as
in-process filesystem calls and pays none of it.

| Symptom                                         | Cause                                           | Severity     |
| ----------------------------------------------- | ----------------------------------------------- | ------------ |
| Every operation fails in the built `.app`       | bare `npx` not on the GUI PATH                  | **Critical** |
| Uninstall takes ~60-90 s                        | one `npx` subprocess per provider, sequential   | **High**     |
| Re-install of an on-disk skill costs full price | no local content cache; re-clones every time    | **High**     |
| Copy dead-ends permanently once state is dirty  | `Conflict` refuses instead of repairing         | **Medium**   |
| Partial uninstall leaves inconsistent state     | loop aborts on first non-zero exit              | **Medium**   |
| Fan-out can destroy the source bundle           | no alias-of-canonical guard across 64 providers | **Medium**   |

---

## 2. Measurements

### 2.1 Environment (the `.app`-only failure)

```
GUI .app PATH      exit=-1 RED  spawnSync npx ENOENT
login shell PATH   exit=0 GREEN
```

Same arguments, same scratch `HOME`, one variable changed. `npx` resolves to
`~/.local/bin/npx`; a Finder-launched bundle gets `/usr/bin:/bin:/usr/sbin:/sbin`.
Confirmed by the user: dev works, the built app does not.

`grep` for PATH handling across `src-tauri/src` and `src/platform` returns zero
hits. There is no resolution step, no preflight check, and no fallback.

### 2.2 Cost breakdown

| Step                                         | Time        | Note                        |
| -------------------------------------------- | ----------- | --------------------------- |
| `npx --yes skills --version`, cold npm cache | 1657 ms     | first-ever run on a machine |
| `npx --yes skills --version`, warm           | 480 ms      | paid on _every_ invocation  |
| `git clone --depth 1` of the source repo     | 1313 ms     | network, every time         |
| `skills add` → 1 provider                    | 2435 ms     | cold                        |
| **Re-install of the same skill, 2nd time**   | **2228 ms** | **nothing is cached**       |
| `skills add` → 64 providers (what we do)     | 8435 ms     |                             |
| `skills remove`, per provider                | 1415 ms     | avg of 5 samples            |
| **Uninstall × 64 providers, sequential**     | **~90 s**   | matches the observed ~1 min |

The re-install row is the important one. A skill already materialised on disk
costs the same as a fresh one, because acquisition always goes back out to
npm and GitHub.

---

## 3. Operation-by-operation audit

### 3.1 Install

**Path:** `installSkillToDisk` → `buildSkillsAddArgs` → `Command.create('npx', …)`
(`src/platform/index.desktop.ts:98-110`)

| Aspect                 | Skilltopia                        | open-knowledge                                                                                  |
| ---------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------- |
| Mechanism              | `npx skills add` subprocess       | in-process `git clone --depth 1` + `symlinkSync`                                                |
| PATH dependency        | yes — bare `npx`                  | none (git only, on acquire)                                                                     |
| Local cache            | none; re-clones every time        | `.ok/skills-lock.json` with `contentHash` as dedupe key                                         |
| Target selection       | all 64 detected providers, always | explicit `targets: EditorId[]`, caller-chosen                                                   |
| Pre-write validation   | none                              | `validateSkillForInstall` — frontmatter gate, rejects git conflict markers                      |
| Existing entry         | left to the CLI                   | `rmSync(dest, {recursive, force})` then link — authoritative replace                            |
| Link form              | n/a                               | relative inside project, absolute across home                                                   |
| Symlink vs copy        | hardcoded symlink                 | `mode: 'symlink' \| 'copy'` — copy for anything a team will clone (Windows `core.symlinks`, CI) |
| Self-destruction guard | none                              | `isAliasOfCanonicalRoot` + `sameEntry` realpath check                                           |
| Error surface          | stderr/stdout string from a TUI   | typed return: `EditorId[]` actually written                                                     |

**Findings**

- **I-1 (Critical).** Bare `npx` is unresolvable in the packaged app. See 2.1.
- **I-2 (High).** No content cache. `installAgentTargetsFromScan` fans out to
  every detected provider, so the cheapest possible install is ~8.4 s and a
  repeat install is not cheaper.
- **I-3 (Medium).** Our registry maps `cline`, `dexto`, `kimi-code-cli`, `loaf`,
  `warp` and `zed` all to `~/.agents/skills`, which is also
  `universal_skills_dir`. Open-knowledge has an explicit guard
  (`isAliasOfCanonicalRoot`) for exactly this shape, because rm-then-link
  through an aliased root deletes the real bundle and replaces it with a
  symlink to its own path. We have no equivalent check.
- **I-4 (Low).** `registry.json` declares the `universal` provider's dir as
  `configHome/agents/skills` (`~/.config/agents/skills`), but
  `paths.rs:264` hardcodes `~/.agents/skills`. The two disagree.

### 3.2 Copy to providers

**Path:** `copy_skill_to_providers` (`src-tauri/src/provider_scan/copy.rs`)

This is the one operation that is already native Rust, and it is the closest
to open-knowledge's model. The gap is policy, not mechanism.

| Aspect              | Skilltopia                                        | open-knowledge                                                                                                            |
| ------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Mechanism           | `std::os::unix::fs::symlink`                      | `symlinkSync` / `cpSync`                                                                                                  |
| Speed               | fast (no subprocess)                              | fast                                                                                                                      |
| Existing entry      | `symlink_metadata().is_ok()` → `Conflict`, refuse | classify, then repair                                                                                                     |
| Disk classification | binary: exists / doesn't                          | 6 verdicts (`skill-path-entry.ts`): `absent`, `symlink→target/elsewhere/dangling`, `dir is-target/same-content/different` |
| Dangling link       | counts as a conflict, blocks forever              | `dangling` → removable, replaced                                                                                          |
| Partial success     | preserved per provider (good)                     | preserved per target (good)                                                                                               |
| Source ambiguity    | hard error, operation aborts                      | resolved by scope precedence                                                                                              |

**Findings**

- **C-1 (Medium).** `copy.rs:222` treats _anything_ at the target as a
  permanent `Conflict`, including a dangling symlink the app wrote itself.
  There is no repair path, so once state is dirty the copy flow errors forever.
  Open-knowledge's `skill-path-entry.ts` exists precisely to tell these cases
  apart, and its header explains why collapsing them is dangerous: the two
  callers legitimately map the same on-disk state to different actions.
- **C-2 (Low).** `resolve_copy_source` returns a hard error on ambiguity,
  aborting all providers. A precedence rule (Universal > real dir > symlink
  target) already exists in the code — it just isn't allowed to break ties.

### 3.3 Uninstall

**Path:** `uninstallSkillFromDisk` (`src/platform/index.desktop.ts:112-152`)

| Aspect            | Skilltopia                                                    | open-knowledge                             |
| ----------------- | ------------------------------------------------------------- | ------------------------------------------ |
| Mechanism         | N × `npx skills remove` subprocesses                          | one in-process loop, `rmSync` per target   |
| Concurrency       | sequential                                                    | n/a — no process to spawn                  |
| Cost              | 1415 ms × provider count ≈ **90 s**                           | milliseconds                               |
| Presence check    | delegated to the CLI                                          | `lstatSync` — does **not** follow the link |
| Dangling link     | likely left behind                                            | detected and removed                       |
| Failure handling  | `throw` on first non-zero exit; remaining providers untouched | returns `EditorId[]` actually removed      |
| Universal cleanup | `deleteUniversalSkill` only if the loop completes             | part of the same pass                      |

**Findings**

- **U-1 (High).** The per-provider subprocess loop is the entire minute. Each
  `npx` invocation re-pays ~480 ms of package resolution before doing any work.
- **U-2 (Medium).** Because the loop throws on the first failure
  (`index.desktop.ts:124-134`), one stale provider leaves every later provider
  installed _and_ skips the Universal cleanup — the user is left worse off
  than before they clicked.
- **U-3 (Medium).** Open-knowledge's `reverseProjectSkill` carries an explicit
  comment on why it uses `lstatSync` over `existsSync`: `existsSync` follows
  the link, sees the missing target, returns false, and leaves the orphan
  symlink behind. That orphan is then exactly what makes the next install hit
  our `Conflict` branch (C-1). Our Rust `delete_universal_skill_dir` gets this
  right; the CLI-delegated per-provider path does not.

---

## 4. What open-knowledge does differently

Four structural choices, in rough order of how much they buy:

1. **No subprocess in the hot path.** Acquisition is one `git clone --depth 1`
   in-process; install, copy and uninstall are `symlinkSync` / `cpSync` /
   `rmSync`. There is no PATH to resolve, no package manager to warm, no TUI
   output to parse for errors, and no per-target process to spawn. This alone
   removes findings I-1, I-2 and U-1.

2. **Content-addressed acquisition.** `skills-lock.json` records `source`,
   `ref` (resolved commit sha) and `contentHash` per skill. "Do I already have
   this?" is a hash lookup, so an unchanged upstream is a correct no-op rather
   than a re-clone.

3. **Classify before mutating.** `skill-path-entry.ts` answers only the factual
   question of what is on disk and takes no position on what to do about it;
   callers map its six verdicts to their own actions. This is what lets install
   be _authoritative_ — rm-first, then link, safely — instead of bailing out
   with a conflict. Their comment is blunt about the stakes: the two callers
   "both gate destructive writes, so keeping two copies of that walk is the
   hazard."

4. **Incremental index instead of full rescans.** `file-watcher.ts` maintains a
   content-hashed file index as things change, and `enumerateInstalledSkills`
   de-dupes the same skill across harnesses into one entry. Our `scan_installed`
   does correctly skip providers that share `universal_skills_dir`, so it is not
   the bottleneck today — but it is a full walk on every call, and it runs
   before _and_ after each install.

Worth noting what is _not_ the difference: our arguments to the `skills` CLI
are correct, and our Rust scan already de-dupes shared directories. The gap is
architectural, not a collection of small bugs.

---

## 5. Recommended sequence

1. **Fix I-1 first** — it is the only finding that makes the shipped product
   completely non-functional. Either resolve the `npx` absolute path at startup
   (and surface a clear error when Node is absent), or skip ahead to step 2,
   which removes the dependency entirely.
2. **Move install and uninstall into Rust**, alongside the copy path that is
   already there. `copy.rs` proves the mechanism works; install and uninstall
   are the same `symlink` / `rm` primitives plus a `git clone` for acquisition.
   This closes I-1, I-2, U-1 and U-2 together.
3. **Replace the binary exists-check with a classifier** modelled on
   `skill-path-entry.ts`, then make install authoritative (rm-first). Closes
   C-1 and U-3.
4. **Add the alias-of-canonical guard** before any rm-then-link fan-out.
   Closes I-3. Our registry has the collision shape today.
5. **Add a content cache** keyed by resolved commit sha. Closes the re-install
   cost.

Steps 1 and 2 are the ones the user feels. Steps 3-5 are what stop the state
from rotting into permanent errors.
