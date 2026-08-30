# 0001 — Vendor the updater module per app rather than share a package

- Status: accepted
- Date: 2026-08-30

## Context

Skilltopia (open source, public GitHub Releases) and Gitsu (private, sold as a
paid DMG) both need a Tauri v2 auto-updater with the same policy core: a
serialized check/download/install state machine, a scheduler (startup + periodic

- focus), dismissal logic, and a product-styled dialog. The two apps diverge in
  exactly one place — the update _source_: Skilltopia reads a static public
  `latest.json`; Gitsu must call an authenticated feed that checks the subscriber's
  entitlement before returning a signed, short-lived download URL.

We considered three ways to reuse the shared code:

1. **Vendored copy** — `src/platform/updates/` lives in each repo, edited
   independently, synced by hand.
2. **Shared npm package** — both apps depend on a published/workspace package.
3. **Hybrid** — package the identical policy core, keep the source adapter per app.

## Decision

Vendor the module (option 1). Each repo owns a copy of `src/platform/updates/`.

## Consequences

- A published package would couple an **open-source** app and a **private** app on
  a single release cadence and add a versioning tax for an ~8-file module whose
  divergence lives precisely at the source adapter. Our coding standard rejects
  speculative generality; a package is that generality until a third Tauri app
  exists.
- The cost is drift: a fix in one copy is not automatically in the other. We
  accept this and mitigate by keeping the _policy core_ (controller, scheduler,
  state machine, dialog) byte-identical across repos so a diff is a clean
  cherry-pick, and by isolating all per-app difference behind the `UpdateSource`
  port.
- Revisit and promote to the hybrid split (option 3) if a third Tauri app appears,
  or if drift between the two copies causes a real defect.
- Sequencing: Skilltopia ships the module end-to-end first (simpler public-GitHub
  source, no backend); Gitsu is a second epic that copies the hardened module and
  supplies the entitled-feed source plus its backend.
