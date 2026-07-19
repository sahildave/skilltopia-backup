# Enrichment pipeline

Run the bounded seed pipeline with `npm run enrich:local` (Infisical
**`dev`**). It reads the top leaderboard slice, stores each detail response in
the private repository, extracts required metadata with the configured AI model
chain, falls back to rule-based extraction, and upserts distilled text into
Qdrant.

## LLM config (Infisical `dev` / `prod`)

| Key                            | Purpose                       |
| ------------------------------ | ----------------------------- |
| `GROQ_API_KEY`                 | Groq (`@ai-sdk/groq`)         |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini (`@ai-sdk/google`)     |
| `ENRICHMENT_MODEL_CHAIN`       | Ordered `provider/model` list |

Recommended chain (supports AI SDK `generateObject` / `json_schema`):

```bash
ENRICHMENT_MODEL_CHAIN=groq/openai/gpt-oss-20b,gemini/gemini-3.1-flash-lite
```

Do **not** use `groq/llama-3.1-8b-instant` — Groq rejects `json_schema` on that
model. Prefer `gemini-3.1-flash-lite` / `gemini-3.5-flash` over `gemini-2.5-*`
(2.5 is blocked for many new API keys).

Order is try-next-on-failure; **rule-based extraction is always last** in code.
Skip a provider by omitting its API key. Also configure Supabase and Qdrant
(see [infisical.md](./infisical.md)).

The local process also needs `VERCEL_OIDC_TOKEN` (e.g. from `.env.local` after
`vercel link`) unless it is run through a linked Vercel environment.

## Modes

| Flag | Behavior |
| --- | --- |
| (default) | Seed: skip skills that already have enrichment |
| `--sync` | Re-enrich only when the detail content hash changed |
| `--force` | Re-enrich even when enrichment already exists (same hash) |

Set `MAX_ENRICHED` in Infisical (`dev`) or the shell (e.g. `MAX_ENRICHED=20 npm
run enrich:local`) to bound a run. Invalid/missing values default to 500; the
hard cap in code is always 500.

`npm run enrich:local` prints colored step-by-step progress on stderr, including
per-model failures and `confidence=llm|rule-based`.
