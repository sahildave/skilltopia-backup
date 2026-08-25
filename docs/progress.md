# Progress — Plugin-delivered skills: enumerate, attribute, and protect

| ID | Task | Status | Dependencies |
| --- | --- | --- | --- |
| 10 | Skill provenance: an origin field on the scan snapshot | passed | - |
| 11 | Read installed_plugins.json and resolve active plugin installs | passed | - |
| 12 | Enumerate the skills shipped by one plugin install path | passed | - |
| 13 | Merge plugin skills into the installed scan snapshot | passed | 10, 11, 12 |
| 14 | Enforce plugin skills as read-only, and show their origin | passed | 13 |
| 15 | Cache the installed scan and invalidate on filesystem change | passed | 13 |

<!-- afk:progress:28 -->

## Progress — Bulk copy all skills from one provider into another

| ID | Task | Status | Dependencies |
| --- | --- | --- | --- |
| 21 | Prefactor: shared copy-provider checkbox row and progress primitive | passed | - |
| 22 | Copy all skills from one provider into another | pending | 21 |
| 23 | Live progress during a bulk skill copy | pending | 22 |


<!-- /afk:progress:28 -->
