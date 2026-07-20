# Installed skill uninstall (card overflow + confirm animation)

**Milestone:** mvp  
**Depends on:** installed-skills scan + library view (done)

## Goal

Add an **Uninstall** action to each installed skill card in the Library view. The action lives in a card overflow menu, uses a two-step confirm flow with `motion/react` animation, then removes the skill via the skills CLI and rescans.

## Context

- Installed skills render as cards in `SkillsLibraryView` (`SkillCardGrid`) with no overflow menu today.
- Install already shells to `npx skills add …` via `install-command.ts` / `index.desktop.ts`.
- The upstream skills CLI supports `npx skills remove` with `-g`, `-a`, `-y` (see [skills remove docs](https://vercel-labs-skills.mintlify.app/commands/remove)).
- `ScannedSkill` carries `name`, `providerIds`, and `paths[]` for agent scoping decisions.
- `useInstalledScanStore().rescan()` refreshes UI after disk changes.

### motion/react in Tauri

**No Tauri-specific problem.** Tauri renders the same React bundle in a system WebView; `motion/react` is DOM/CSS animation only (no native bridge). This repo already uses it in `SkillsDashboardView.tsx` with `useReducedMotion()` — reuse that pattern for the confirm swap.

**Non-Tauri gotcha:** Radix `DropdownMenu` closes on select by default. For inline confirm inside the menu, use `onSelect={(e) => e.preventDefault()}` on the delete item, or prefer `Popover` for the overflow panel. Not a desktop vs web issue.

## Scope

### UI

- [ ] Add overflow trigger (e.g. `MoreHorizontal`) on each installed skill card in `SkillCardGrid`.
- [ ] Menu content: **Uninstall** item → animated confirm row (**Yes, uninstall** / **Cancel**) using `AnimatePresence` + `motion/react`.
- [ ] Honor `useReducedMotion()` — skip or simplify transitions when reduced motion is preferred (match `SkillsDashboardView`).
- [ ] Disable actions while uninstall is in flight; toast success/error (mirror install toasts in `SkillsDashboardView`).
- [ ] i18n strings in `locales/*.json`.

### Platform

- [ ] Add `buildSkillsRemoveArgs(skillName, { scope, agent? })` alongside `buildSkillsAddArgs` in `install-command.ts` (+ unit tests).
- [ ] Extend `PlatformPort` with `uninstall(skillName, options)` (or equivalent).
- [ ] **Desktop:** shell `npx skills remove …` like install (`index.desktop.ts`).
- [ ] **Web:** copy pasteable remove command to clipboard (like web install).
- [ ] **Mock:** no-op success (`index.mock.ts`).

### Agent scoping (product rules)

| Sidebar filter    | CLI behavior                                                                        |
| ----------------- | ----------------------------------------------------------------------------------- |
| All agents        | `skills remove {name} -g -y -a '*'` — confirm copy says removes from **all** agents |
| Specific provider | `skills remove {name} -g -y -a {providerId}`                                        |
| Universal         | `skills remove {name} -g -y` (canonical `.agents/skills`)                           |

- [ ] Pass current `providerFilter` from `useInstalledSkillsUiStore` into the card/menu handler.

### Post-uninstall

- [ ] Call `useInstalledScanStore.getState().rescan()` on success.

## Out of scope

- Uninstalling or “removing” an agent/provider from the sidebar (agents are detected, not app-installed).
- Project-scoped skills (scan is global-only today; see post-mvp task-11).
- Rust filesystem delete command (delegate to skills CLI, same as install).
- New icon library (use `lucide-react`, e.g. `Trash2`).

## TDD seams

- `buildSkillsRemoveArgs` — unit tests mirroring `install-command.test.ts`.
- `SkillsLibraryView.test.tsx` — overflow opens, confirm flow, calls platform uninstall, triggers rescan (mock `@platform`).

## Done when

- Desktop: uninstall removes skill from disk for the selected agent scope; card disappears after rescan.
- Web: overflow offers copy-remove-command UX consistent with install.
- Confirm animation works in Tauri and Chrome; respects reduced motion.
- `npm run check:all` passes.
