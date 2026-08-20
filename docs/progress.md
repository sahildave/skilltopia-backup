# Progress — Skill lifecycle rearchitecture: in-process install, copy and uninstall

| ID | Task | Status | Dependencies |
| --- | --- | --- | --- |
| 2 | Resolve an absolute Node/npx path so the packaged .app can spawn it | integration_failed | - |
| 3 | Reconcile the universal skills directory: registry.json vs paths.rs | integration_failed | - |
| 4 | Path classifier: report what is at a skill target, without acting on it | ready_to_integrate | - |
| 5 | In-process skill acquisition with a content-addressed cache | running | - |
| 6 | In-process projection: install, copy and uninstall without subprocesses | blocked | 3, 4, 5 |
| 7 | Port the desktop platform adapter off npx to typed commands | blocked | 6 |
| 8 | Acceptance: verify the skill lifecycle in a packaged .app | blocked | 2, 7 |

