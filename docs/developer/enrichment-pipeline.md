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

Current chain in Infisical:

```bash
ENRICHMENT_MODEL_CHAIN=groq/llama-3.1-8b-instant,gemini/gemini-2.5-flash-lite
```

Order is try-next-on-failure; **rule-based extraction is always last** in code.
Skip a provider by omitting its API key. Also configure Supabase and Qdrant
(see [infisical.md](./infisical.md)).

The local process also needs `VERCEL_OIDC_TOKEN` unless it is run through a
linked Vercel environment.

## Modes

Use `npm run enrich:local -- --sync` for the sync stub. Seed mode skips every
skill that already has enrichment; sync mode re-enriches only when the detail
hash differs from the stored hash.

Set `MAX_ENRICHED` in Infisical (`dev`) or the shell (e.g. `MAX_ENRICHED=20 npm
run enrich:local`) to bound a run. Invalid/missing values default to 500; the
hard cap in code is always 500.

`npm run enrich:local` prints step-by-step progress on stderr (`[enrich …]`)
so long leaderboard/detail/LLM/Qdrant waits are visible.
