# Qdrant embeddings

The Backend API and local enrichment scripts use `api/_lib/qdrant.ts` for
semantic vectors. The desktop app must not import this module or receive the
Qdrant API key.

## Cloud setup

1. Create a Qdrant Cloud free cluster.
2. Open the cluster’s Inference tab and confirm that the selected model is
   labelled `Cost: Free`. New clusters have Inference enabled by default;
   enable it manually for older clusters.
3. Create an API key and keep it in the Backend API or local enrichment
   environment only.

The default model is `sentence-transformers/all-MiniLM-L6-v2`, a free dense
model with 384 dimensions. The collection is created lazily on the first
upsert as `skill_embeddings`, with a named `dense` vector using cosine
distance. If an existing collection has a different vector size, the helper
fails instead of silently writing incompatible points.

## Environment

```bash
QDRANT_URL=https://<cluster-host>
QDRANT_API_KEY=<server-only-key>
# Optional: change these together when switching models.
QDRANT_COLLECTION=skill_embeddings
QDRANT_EMBEDDING_MODEL=sentence-transformers/all-MiniLM-L6-v2
QDRANT_VECTOR_NAME=dense
QDRANT_VECTOR_SIZE=384
```

`upsertSkillEmbedding(skillId, distilledText)` sends only the distilled
enrichment text to Qdrant. Cloud Inference creates the vector at upsert time;
the point payload contains only `skill_id`. Full enrichment and raw files
remain in the Supabase repository.

`searchNearestSkills(skillId, limit)` retrieves the indexed source vector and
queries nearest neighbors while excluding the source skill. It returns IDs and
scores so callers can hydrate metadata through the repository.

The current MVP budget is controlled by the enrichment pipeline (`MAX_ENRICHED`
starts at 500); this adapter does not index the full skills.sh corpus.
