# Copy providers: integration and quality slice

**Milestone:** mvp  
**Depends on:** tasks 1–2

## Goal

Finish the user-visible operation with filesystem-truth refresh, concise feedback, and complete verification.

## Scope

- [x] Submit selected providers through the platform boundary and close the dialog after an attempted operation.
- [x] Rescan after success or partial success so badges, counts, sidebar state, and dialog grouping update immediately.
- [x] Show bounded result toasts with success counts and conflict/failure provider names; do not add a “View details” affordance.
- [x] Keep unrecoverable command errors actionable and avoid claiming success.
- [x] Add i18n strings and integration tests for rescan, partial results, toast content, and desktop-only behavior.
- [x] Run targeted tests, `npm run test:all`, `npm run check:all`, Rust formatting, and clippy.
- [x] Verify the web bundle contains no Tauri markers and the MVP task is ready to move to `tasks-done/`.

## Done when

- The full copy flow is verified from selection through refreshed installed state, including conflict and partial-failure behavior.

## Verification notes (2026-07-21)

- Related suites green: `CopyProvidersDialog`, `SkillCardOverflowMenu`, `platform`.
- Rust copy/scan tests green; `npm run build:web` + `scan:web-bundle` clean.
- `npm run test:all` / `check:all` still hit pre-existing unrelated failures (`App.test`, stale `enrichment-pipeline` MAX_ENRICHED expectations, `design:check` dark-canvas drift).
