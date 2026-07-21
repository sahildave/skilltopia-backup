# Open-source public repo launch

**Milestone:** release  
**Depends on:** none (do today)  
**Priority:** 20 — first release task

## Goal

Make the GitHub repo safe and credible to go **public**: correct license/README, no secrets or probe junk, basic contributor/security hygiene, GitHub About filled in.

## Context

Repo is still template-shaped (`README.md` is “Tauri React Template”, `LICENSE.md` copyright is “Tauri Template Contributors”). Untracked `.tmp-probe/` HTML must never land in git. Public launch is independent of notarization but should happen before ProductHunt.

## Scope

- [ ] Update [`LICENSE.md`](../../LICENSE.md) copyright to the real holder / year
- [ ] Rewrite [`README.md`](../../README.md) for Skills Explorer: what it is, web vs desktop, install from Releases (placeholder OK until v1 artifacts exist), screenshots later
- [ ] Add `CONTRIBUTING.md` (how to run web/desktop, `npm run check:all`, PR expectations) — keep short
- [ ] Add `SECURITY.md` (how to report vulnerabilities; no public issue dump for secrets)
- [ ] Scrub template leftovers that would confuse contributors (`YOUR_USERNAME`, “Tauri Template App” in user-facing docs if any)
- [ ] Confirm `.gitignore` covers local probes, keys, `.env*`, Infisical leftovers; never commit `.tmp-probe/`
- [ ] GitHub repo Settings → General: description, website, topics; enable Discussions if that is the support channel
- [ ] Set repo visibility to **public** when the above is done
- [ ] Pin or link Releases / Sponsors in README once those exist (tasks 21 / 26)

## Out of scope

- GitHub Sponsors application (task-21)
- Code signing / notarization (tasks 24–25)
- ProductHunt copy (task-28)
- Full marketing site

## Done when

- Repo is public (or ready to flip) with accurate README + LICENSE
- No secrets or probe artifacts in the tree
- CONTRIBUTING + SECURITY exist
- A stranger can clone and understand how to run and where binaries will come from
