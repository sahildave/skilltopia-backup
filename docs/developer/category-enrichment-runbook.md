# Category classification & backfill runbook

Operational steps to assign skill **categories** across the corpus using a local
model, and to backfill categories onto already-enriched skills. This is the
human-run half of epic #53 (gates #56 and #58); the code half — the taxonomy,
the classifier prompt, and the faceted search — is already merged.

Background on the pipeline itself is in
[enrichment-pipeline.md](./enrichment-pipeline.md); this file is just the
category-specific run procedure.

## What already exists

- `api/_lib/taxonomy.ts` — `SKILL_CATEGORIES` (30 slugs) and `CATEGORY_GLOSS`
  (one-line gloss per slug).
- `api/_lib/enrichment.ts` — the classifier prompt interpolates the glosses and
  constrains output to `z.enum(SKILL_CATEGORIES)`. Categories are one field in
  the existing `generateObject` call; there is no separate classifier pass.
- `api/skills/search.ts` / `api/_lib/qdrant.ts` — search pre-filters on the
  `categories` payload facet. Keyword results are hydrated from Supabase and
  filtered with the same verified labels; the vector is untouched, so adding
  categories needs no re-embedding.
- `api/skills.ts` — leaderboard rows are hydrated with the same category
  metadata. Missing enrichment leaves a row visible with an empty category
  list, so discovery does not fail closed.

Because categories ride the existing enrichment call, classification runs by
**pointing the existing pipeline at a local model via env overrides** — no new
code path.

## Model chain and endpoint

The default chain is hosted (`groq/…,gemini/…`). To run locally through Ollama:

| Env                      | Value                                   | Why                                                                            |
| ------------------------ | --------------------------------------- | ------------------------------------------------------------------------------ |
| `ENRICHMENT_MODEL_CHAIN` | `openai/qwen3:14b`                      | `openai/` routes to the `createOpenAI` provider; `qwen3:14b` is the Ollama tag |
| `OPENAI_BASE_URL`        | `http://localhost:11434/v1`             | Ollama's OpenAI-compatible endpoint                                            |
| `MAX_ENRICHED`           | batch size (default 500, hard cap 1500) | bound the run                                                                  |

`enrich:local` wraps the run in `infisical run --env=dev`, so Supabase and Qdrant
creds come from Infisical `dev`.

`scripts/enrich.mjs` modes: default `seed` (skips already-enriched skills),
`--force` (re-enriches everything), `--sync`.

## Preconditions

Run all commands from the branch checkout. Check these first and stop if any fails:

1. **Model pulled and served.**
   ```bash
   ollama list                      # is a suitable model present?
   ollama pull qwen3:14b            # ~9GB if not; a smaller instruct model works, at some accuracy cost
   curl -s localhost:11434/v1/models   # confirm the OpenAI-compatible endpoint is up
   ```
2. **Infisical authed** so `enrich:local`'s `--env=dev` resolves (needs Supabase + Qdrant).
3. **One-skill smoke run** before any batch, so a bad model/endpoint fails cheap.

## Gate #56 — classification run + eval

1. **Build a ~30–50 item gold set.** Pick real skills and write the human-correct
   `categories` (primary first), drawn only from `SKILL_CATEGORIES`. Commit it
   (e.g. `docs/developer/category-goldset.json`). The labels must be human — a
   model-labelled gold set makes the eval circular.
2. **Classify the gold set locally:**
   ```bash
   MAX_ENRICHED=30 \
   ENRICHMENT_MODEL_CHAIN=openai/qwen3:14b \
   OPENAI_BASE_URL=http://localhost:11434/v1 \
   npm run enrich:local
   ```
   Use an explicit skill-id list if the pipeline accepts one, to hit exactly the
   gold set.
3. **Diff output vs gold** and report agreement (primary-category accuracy +
   multi-label overlap). Document a `needsReview` triage rule (e.g. flag any skill
   whose model primary disagrees with gold).
4. **Review the number.** If agreement is poor, decide (bigger model, prompt
   tweak, or descope) **before** touching the production corpus.

Release when satisfied:

```bash
afk epic 53 --accept=56
```

## Gate #58 — backfill the existing corpus

> ⚠️ This **writes to the production Supabase/Qdrant corpus.** Only after #56 is accepted.

1. **Full re-enrich pass** (`--force` re-processes already-enriched skills; the
   default `seed` mode would skip them, so no categories would land):
   ```bash
   MAX_ENRICHED=1500 \
   ENRICHMENT_MODEL_CHAIN=openai/qwen3:14b \
   OPENAI_BASE_URL=http://localhost:11434/v1 \
   npm run enrich:local -- --force
   ```
2. **Report** `attempted / enriched / skipped / failed` from the run's JSON
   summary, plus the count of skills still missing `categories` (note if capped
   by `MAX_ENRICHED`).
3. **Spot-check a few Qdrant points** to confirm the `categories` payload is set.

Release:

```bash
afk epic 53 --accept=58
```

## After both gates

- **#60 (launchd timer)** depends on #56. Plan-review flagged that #58 and #60
  both run the enrichment pipeline against the same corpus — sequence #60 **after**
  #58, or scope #60 to installing the timer without a live end-to-end run.
- Then `afk finish` prints the closeout and the `gh pr merge` command.

## Search facet behavior

`api/skills/search.ts` strips the `category` parameter before proxying to
skills.sh, then over-fetches keyword results and filters them against verified
Supabase category metadata. Qdrant applies the same category constraint to its
semantic leg. If Qdrant is unavailable, the endpoint returns filtered keyword
matches with `semanticUnavailable: true`; if category metadata itself is
unavailable, the category-filtered request fails closed with a `503` rather
than returning unverified or unfiltered rows.
