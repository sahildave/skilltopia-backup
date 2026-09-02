# CONTEXT

Canonical vocabulary for this repo. Glossary only — no implementation details.

## Updater domain

- **Updater artifact** — the payload the auto-updater downloads and applies to an
  already-installed app. On macOS this is a `.app.tar.gz` (plus its `.sig`), on
  Windows the installer, on Linux the AppImage. It is _not_ the first-install
  distributable.
- **Installer / DMG** — the distributable a new user downloads for a _first_
  install. Distinct from the Updater artifact; the DMG is never the update
  mechanism.
- **Feed** — the endpoint the updater checks to learn whether a newer version
  exists. Skilltopia's feed is a static `latest.json` on public GitHub Releases.
- **Entitled feed** — Gitsu's authenticated feed: it verifies the signed-in
  subscriber's current entitlement server-side, then returns an update only if
  they may receive it. Contrast with Skilltopia's static, unauthenticated feed.
- **Updater signature** — the minisign signature over an Updater artifact, made
  with the product's Tauri updater private key and verified against the embedded
  public key. An _integrity_ control: it proves the artifact is untampered.
- **Developer ID signature** — Apple's code signature plus notarization that lets
  Gatekeeper trust the app on download. A _distribution-trust_ control, independent
  of the Updater signature; one does not replace the other.
- **Entitlement** — a current, server-side decision that a signed-in user may
  receive a paid release. Distinct from a **cached entitlement**, a client-side
  copy of the last decision used for offline product gating — never trusted by the
  update feed as proof of eligibility.
- **Channel** — a named release track (`stable`, `beta`, `canary`). Not
  user-editable via URL; selected from an account setting (Gitsu) or a persisted
  opt-in (Skilltopia).
- **Rollout cohort** — the deterministic subset of installs a gradual rollout is
  released to, computed from a stable hash so a 10% release stays the same 10%
  across restarts. Never `Math.random()` per check.
