# Backup-repo consolidation archive

In September 2026 the private working repo `sahildave/skilltopia-backup` was merged back
into the public `sahildave/skilltopia` (migration epic: backup issue #65). The tips at
consolidation are tagged `pre-consolidation-private-2026-09-02` and
`pre-consolidation-public-2026-09-02`. Full mirrors of both repos, plus JSON exports of the
backup repo's issues, its 9 merged pull requests (bodies, comments, reviews, patches),
milestones and labels, live off-GitHub in the maintainer's backup archive.

Issue numbers changed on transfer (the public repo's PRs already occupied #1–#14).

## Issue number mapping (old → new)

| Backup # | Public # | Title                                                                                                        |
| -------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| 1        | 18       | Skill lifecycle rearchitecture: in-process install, copy and uninstall                                       |
| 2        | 19       | Resolve an absolute Node/npx path so the packaged .app can spawn it                                          |
| 3        | 20       | Reconcile the universal skills directory: registry.json vs paths.rs                                          |
| 4        | 21       | Path classifier: report what is at a skill target, without acting on it                                      |
| 5        | 22       | In-process skill acquisition with a content-addressed cache                                                  |
| 6        | 23       | In-process projection: install, copy and uninstall without subprocesses                                      |
| 7        | 24       | Port the desktop platform adapter off npx to typed commands                                                  |
| 8        | 25       | Acceptance: verify the skill lifecycle in a packaged .app                                                    |
| 9        | 26       | Plugin-delivered skills: enumerate, attribute, and protect                                                   |
| 10       | 27       | Skill provenance: an origin field on the scan snapshot                                                       |
| 11       | 28       | Read installed_plugins.json and resolve active plugin installs                                               |
| 12       | 29       | Enumerate the skills shipped by one plugin install path                                                      |
| 13       | 30       | Merge plugin skills into the installed scan snapshot                                                         |
| 14       | 31       | Enforce plugin skills as read-only, and show their origin                                                    |
| 15       | 32       | Cache the installed scan and invalidate on filesystem change                                                 |
| 17       | 33       | Install skills published from a website, not a GitHub repository                                             |
| 19       | 34       | Epic #1 follow-up: resolve git to an absolute path, fix false subprocess docs, delete orphaned npx machinery |
| 21       | 35       | Prefactor: shared copy-provider checkbox row and progress primitive                                          |
| 22       | 36       | Copy all skills from one provider into another                                                               |
| 23       | 37       | Live progress during a bulk skill copy                                                                       |
| 28       | 38       | Bulk copy all skills from one provider into another                                                          |
| 30       | 39       | Skilltopia auto-updater: vendored module, real dialog, hardened release                                      |
| 31       | 40       | Updater module core + i18n (vendored src/platform/updates)                                                   |
| 32       | 41       | Release CI hardening + updater-key verification                                                              |
| 33       | 42       | App-shell integration: controller + scheduler + UpdateDialog in App.tsx                                      |
| 34       | 43       | Manual check: native menu + command-palette entries                                                          |
| 36       | 44       | # Repo owner avatar on catalog skill card                                                                    |
| 37       | 45       | # GitHub Sponsors                                                                                            |
| 38       | 46       | # macOS Developer ID signing and notarization                                                                |
| 39       | 47       | # Windows code signing                                                                                       |
| 40       | 48       | # Public Backend API readiness and privacy                                                                   |
| 41       | 49       | # ProductHunt launch                                                                                         |
| 42       | 50       | # Mac App Store distribution                                                                                 |
| 43       | 51       | # Meilisearch full-corpus keyword (evolve to stack A)                                                        |
| 44       | 52       | # Grow enrichment budget toward 2K+                                                                          |
| 45       | 53       | # Analytics and install-history snapshots                                                                    |
| 46       | 54       | # Compare skills                                                                                             |
| 47       | 55       | # Project-scoped installed skills                                                                            |
| 48       | 56       | # Local query embedding (remove Qdrant inference from hot path)                                              |
| 49       | 57       | # Search performance: backend critical path                                                                  |
| 50       | 58       | # Search performance: progressive keyword-first results                                                      |
| 51       | 59       | # Hidden Gems and growth discovery rails                                                                     |
| 52       | 60       | # Cross-ecosystem AI Capability index                                                                        |
| 53       | 61       | Skill taxonomy + faceted semantic search                                                                     |
| 54       | 62       | Finalize the skill taxonomy slugs                                                                            |
| 55       | 63       | Expose categories in the search API response                                                                 |
| 56       | 64       | Category classification run + eval harness (local Ollama)                                                    |
| 57       | 65       | UI: category icon + label binding                                                                            |
| 58       | 66       | Backfill categories onto existing skills                                                                     |
| 59       | 16       | UI: category filter control + result pills                                                                   |
| 60       | 17       | Ops: launchd timer for local ingest freshness                                                                |
| 66       | 67       | Freeze both repos, tag tips, mirror off-GitHub                                                               |
| 67       | 68       | Secret & content audit of the 137 private-only commits                                                       |
| 68       | 69       | Close the CI secret gap (TAURI_SIGNING_PRIVATE_KEY) + verify Vercel env                                      |
| 69       | 70       | Export backup tracker archive: issues, 9 PRs, milestones, labels                                             |
| 70       | 71       | Rewrite backup-repo links in docs; scaffold consolidation archive index                                      |
| 71       | 72       | Publish: migration branch + merge-commit PR into public main                                                 |
| 72       | 73       | Migrate milestones and issues to the public repo; record number mapping                                      |
| 73       | 74       | Verify deployment, smoke-test production, confirm ingest goes green                                          |
| 74       | 75       | Retire the backup repo: archive now, delete 2026-10-02; normalize remotes                                    |

The consolidation epic itself (backup #65, with children #75-#77) transfers after it closes.
