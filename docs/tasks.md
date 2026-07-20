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
