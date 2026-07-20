# Provider registry sync and parity data

**Milestone:** provider-detection

**Depends on:** task-2 dual-client foundation

## Goal

Vendor the provider registry and detection semantics from the canonical
[`vercel-labs/skills`](https://github.com/vercel-labs/skills) repository so the
desktop scanner, web/mock adapters, and UI share one deterministic provider
definition.

## Scope

- [ ] Define a shared declarative registry containing the upstream provider ID,
      display name, global skills directory, Universal classification, visibility
      flags, platform-specific paths, and detection probes.
- [ ] Preserve skills.sh semantics: Universal means the provider has
      `skillsDir` equal to `.agents/skills`; detection remains the upstream
      directory/config presence check, including known macOS/Windows exceptions.
- [ ] Represent ordinary path checks as data and support a small named
      special-probe mechanism for rules that cannot be expressed declaratively.
- [ ] Record source metadata in the generated registry: repository URL,
      upstream commit, and MIT attribution.
- [ ] Add a generator that reads the upstream `src/agents.ts` and writes the
      checked-in registry data; do not parse upstream TypeScript at runtime.
- [ ] Add a weekly GitHub Actions workflow that generates a proposed update,
      runs validation/tests, and opens a reviewable PR. Do not merge or change
      production data automatically.
- [ ] Fail the workflow and create no PR when generation or validation fails.

## Out of scope

- Authentication or credential detection.
- Runtime network fetching of the registry.
- Project-local skill directories.
- UI placement for source attribution; a later modal/overflow surface can use
  the registry metadata.

## Done when

- The checked-in registry matches the selected upstream snapshot.
- Universal/non-Universal classification and probe behavior have parity tests.
- The weekly workflow can produce a validated update PR.
- The app has one canonical source URL: `https://github.com/vercel-labs/skills`.
