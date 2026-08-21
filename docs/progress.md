# Progress — Plugin-delivered skills: enumerate, attribute, and protect

| ID | Task | Status | Dependencies |
| --- | --- | --- | --- |
| 10 | Skill provenance: an origin field on the scan snapshot | passed | - |
| 11 | Read installed_plugins.json and resolve active plugin installs | passed | - |
| 12 | Enumerate the skills shipped by one plugin install path | passed | - |
| 13 | Merge plugin skills into the installed scan snapshot | pending | 10, 11, 12 |
| 14 | Enforce plugin skills as read-only, and show their origin | pending | 13 |
| 15 | Cache the installed scan and invalidate on filesystem change | pending | 13 |

