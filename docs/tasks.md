# Task Management

## Overview

- **Uncompleted tasks** are in tasks-todo/
  - Named task-NUMBER-name.md where NUMBER indicates priority order
  - The lowest number is the current task
  - If NUMBER is x, the task has not been prioritized yet
  - **post-mvp** milestone tasks use `task-x-post-mvp-N-name.md` so they stay unprioritized and can renumber from 1 per future epic without colliding with the active MVP sequence
- **Completed tasks** are in tasks-done/
  - Named task-YYYY-MM-DD-name.md (or with HH:MM) with completion date

## Completing Tasks

When you finish a task, use the completion script.

Usage: npm task:complete TASK_NAME_OR_NUMBER

Examples:
npm task:complete frontend-performance
npm task:complete 2
npm task:complete awesome-feature

The script will:

1. Find the matching task in tasks-todo/
2. Strip the task-NUMBER- prefix
3. Add todays date prefix: task-YYYY-MM-DD-HH:MM
4. Move it to tasks-done/

Example transformation:
tasks-todo/task-2-frontend-performance-optimization.md
becomes
tasks-done/task-2025-11-01-14:30-frontend-performance-optimization.md

### Renaming Existing Completed Tasks

Backfill missing dates/times from each file's last modified time. Skips files that already have `YYYY-MM-DD-HH:MM`.

Usage: npm task:rename-done

## Release epic (from task-20)

Open-source desktop distribution and launch. Numbered from **20** so they sit after leftover MVP todos (8–11) without renumbering. Active priority is this epic; search latency work lives under unprioritized `task-x-post-mvp-*`. Work **20–21 today**; PH and App Store are later.

| # | Task | When |
|---|------|------|
| 20 | [Open-source public repo launch](./tasks-todo/task-20-open-source-public-launch.md) | Today |
| 21 | [GitHub Sponsors](./tasks-todo/task-21-github-sponsors.md) | Today |
| 22 | [Product identity / rebrand](./tasks-todo/task-22-product-identity-rebrand.md) | Next |
| 23 | [Tauri updater signing](./tasks-todo/task-23-tauri-updater-signing.md) | Next |
| 24 | [macOS Developer ID + notarization](./tasks-todo/task-24-macos-developer-id-notarization.md) | Before PH (start Apple enrollment today) |
| 25 | [Windows code signing](./tasks-todo/task-25-windows-code-signing.md) | Soft for v1 |
| 26 | [First GitHub Release + smoke test](./tasks-todo/task-26-first-github-release.md) | After 22–24 |
| 27 | [Public Backend API + privacy](./tasks-todo/task-27-public-backend-privacy.md) | Before public desktop downloads |
| 28 | [ProductHunt launch](./tasks-todo/task-28-producthunt-launch.md) | Later |
| 29 | [Mac App Store](./tasks-todo/task-29-mac-app-store.md) | Later |

Plan reference: open-source release checklist (Cursor plan).
