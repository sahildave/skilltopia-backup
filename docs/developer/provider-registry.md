# Provider Registry

Checked-in provider definitions vendored from
[`vercel-labs/skills`](https://github.com/vercel-labs/skills) (`src/agents.ts`).

## Layout

| Path                                     | Role                                                        |
| ---------------------------------------- | ----------------------------------------------------------- |
| `src/providers/registry.json`            | Generated declarative registry (source of truth at runtime) |
| `src/providers/upstream/agents.ts`       | Vendored upstream snapshot used for offline parity          |
| `src/providers/types.ts`                 | Registry / probe TypeScript types                           |
| `src/providers/classification.ts`        | Universal / non-Universal helpers (skills.sh semantics)     |
| `src/providers/evaluate-detection.ts`    | Path + special-probe evaluation (tests / shared logic)      |
| `scripts/generate-provider-registry.mjs` | Generator — parses upstream TS at sync time only            |

Do **not** fetch or parse upstream TypeScript at app runtime. Desktop scan
embeds `registry.json` in Rust (`src-tauri/src/provider_scan`) and UI adapters
import helpers from `@/providers` when needed.

## Semantics

- **Universal** means `skillsDir === '.agents/skills'`.
- `getUniversalProviders` excludes `showInUniversalList: false`.
- `getVisibleUniversalProviders` also excludes `showInUniversalPrompt: false`.
- Ordinary detection is declarative path probes (`home`, `configHome`, `cwd`,
  `envHome`, `env`, `absolute` with optional platform filters).
- Named special probes: `eve-installed`, `openclaw-skills-dir`.

## Sync

```bash
npm run providers:generate          # fetch upstream main HEAD
npm run providers:generate -- --commit <sha>
npm run providers:generate -- --input path/to/agents.ts --commit <sha>
```

Weekly GitHub Action `.github/workflows/sync-provider-registry.yml` regenerates,
runs validation, and opens a review PR when the registry changes. It never
merges or updates production data automatically. Generation/validation failure
fails the workflow with no PR.
