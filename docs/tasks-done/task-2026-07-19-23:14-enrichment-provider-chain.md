# Enrichment LLM provider chain (Groq → Gemini → rule-based)

**Epic:** Skills Explorer MVP (24h)
**Milestone:** mvp
**Depends on:** task-4 (enrichment pipeline exists; this corrects the provider wiring)

## Goal

Replace the OpenAI-only enrichment model wiring with a **configurable multi-provider AI SDK chain** so free/cheap models can be swapped and ordered via env — matching the locked grilling decision (Q10 = C).

## Context / bug

Task-4 shipped Vercel AI SDK + model-list fallback + rule-based last, but `createModelsFromEnv` only uses `@ai-sdk/openai` / `OPENAI_API_KEY` / default `gpt-4o-mini`. Docs (`enrichment-pipeline.md`, `infisical.md`) drifted the same way. That is **not** the intended design.

## Decisions

- **Vercel AI SDK only** for LLM calls (`generateObject`)
- Env-driven order via `ENRICHMENT_MODEL_CHAIN`, always ending in **rule-based**
- Default chain for free MVP: **Groq → Gemini → rule-based**
  - Primary: Groq `llama-3.1-8b-instant` (free, fast, good enough for structured extract)
  - Fallback: Gemini free tier (prefer Flash-Lite if daily volume matters)
- Chain entries name **providers** (or `provider/model`), not OpenAI model ids alone
- Provider API keys live in Infisical `dev` / `prod` only — never Infisical `local` / Tauri / `VITE_*`
- Keep existing throttle + retry/backoff; respect free-tier RPM/TPM/RPD

### Locked Infisical config (`dev` + `prod`)

```bash
GROQ_API_KEY=...
GOOGLE_GENERATIVE_AI_API_KEY=...
ENRICHMENT_MODEL_CHAIN=groq/llama-3.1-8b-instant,gemini/gemini-2.5-flash-lite
```

Names match AI SDK defaults (`@ai-sdk/groq`, `@ai-sdk/google`). Documented in
`docs/developer/enrichment-pipeline.md` and `docs/developer/infisical.md`.

## Scope

- [ ] Add AI SDK provider packages needed for Groq + Gemini (drop OpenAI-only assumption unless kept as an optional chain entry)
- [ ] Rewrite `createModelsFromEnv` to resolve chain entries → `LanguageModel[]` across providers; skip providers whose keys are missing
- [ ] Default chain to Groq then Gemini (not `gpt-4o-mini`) when `ENRICHMENT_MODEL_CHAIN` is unset
- [ ] Preserve: try models in order → rule-based last (`enrichWithModel`)
- [x] Update docs: `enrichment-pipeline.md`, `infisical.md` (locked Infisical keys + chain)
- [ ] Tests: provider resolution from env; missing key skips that provider; full LLM fail → rule-based

## Out of scope

- Growing `MAX_ENRICHED` past 500 (post-mvp)
- AI chat / compare skills
- Paying for OpenAI as the default path
- Changing embeddings (stay on Qdrant free inference)

## TDD seams

- Env chain parsing: `groq/…,gemini/…` → ordered models; absent keys omitted
- AI fallback: provider fail → next → rule-based produces usable partial (existing seam; keep green)

## Done when

- `npm run enrich:local` can enrich with only Groq and/or Gemini keys (no `OPENAI_API_KEY` required)
- Setting `ENRICHMENT_MODEL_CHAIN` changes provider/model order without code edits
- Missing/rate-limited providers fall through; pipeline never hard-requires a single vendor
- Docs match the locked free-provider design
