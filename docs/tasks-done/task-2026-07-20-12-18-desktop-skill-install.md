# Desktop skill install (global / project)

**Milestone:** web-desktop  
**Depends on:** task-2  
**Absorbs:** desktop half of former `task-x-post-mvp-8-in-app-install-copy-command` / former task-10

## Goal

In the Tauri app, install a skill to disk (**global** or **project**) via native fs/shell with clear permissions UX.

## Context

- Web copy-command is task-4 — do not reimplement here.
- `install(skill, scope)` lives on `PlatformPort`; this task fills the **desktop** adapter for real installs.

## Scope

- [x] Define install target paths and agent conventions (global vs project)
- [x] Implement `PlatformPort.install` on desktop adapter (Tauri fs/shell)
- [x] Permissions / error UX when scope or path fails
- [x] Wire Install button on desktop to real install (not stub)

## Out of scope

- Web copy UX (task-4)
- Cloud sync of installed skills
- Uninstall / update / Reveal in Finder (add later if needed — not Phase-1 port)

## Done when

- User can install a skill from the desktop app to a chosen scope
- Web build still contains zero Tauri install code paths outside the desktop adapter file
