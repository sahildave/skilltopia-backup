---
name: cleanup
description: Run static analysis tools (knip, jscpd, check:all), get intelligent recommendations for cleanup, and optionally file a GitHub issue.
user-invocable: true
allowed-tools: [Read, Write, Bash, Glob, Edit, Agent]
---

## Execution

1. Spawn the `cleanup-analyzer` agent to run analysis and investigate findings.
2. Present the agent's structured report to the user.
3. Ask the user: "Would you like me to file a GitHub issue for these cleanup items?"
4. If yes, create a GitHub issue with the findings organized as actionable steps.
