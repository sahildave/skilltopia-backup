# Skills.sh Explorer -- Research & Architecture Handoff

## Project Goal

Build a richer discovery experience for the Skills ecosystem than the
official **skills.sh** website by enriching every skill with
AI-generated metadata, summaries, tags, relationships, recommendations,
and analytics.

## Architecture

```text
GitHub / GitLab / .well-known
            │
            ▼
     skills.sh Registry
            │
            ▼
         Public API
            │
            ▼
      Your Local Mirror
            │
            ▼
       AI Enrichment
            │
            ▼
     Search & Discovery UI
```

## What the Skills.sh API Provides

### Leaderboard

- Install counts
- Skill ID
- Name / slug
- Source repository
- Public URL
- Pagination

Use for: - Top 50 - Top 100 - Infinite scroll

### Search

- Keyword search across skills.

### Skill Detail

Returns: - `SKILL.md` - Supporting files - Examples - Metadata - Hash
(use for incremental sync)

### Audit

Security / audit information that can later power badges like: -
Verified - Audited - Potential risks

## Recommended Architecture

Mirror the registry instead of querying live for every request.

1.  Fetch all metadata.
2.  Download every skill once.
3.  Store raw files.
4.  Run AI enrichment.
5.  Save generated metadata.
6.  Refresh daily and only reprocess changed hashes.

## API Limitations

- No historical install history.
- You cannot build npm-style download graphs immediately.
- Store daily snapshots yourself to create trend charts.
- Trending should use the API's hot leaderboard rather than inventing
  your own.

## AI Enrichment

### Rule-Based Extraction

Extract obvious items: - React - TypeScript - Docker - Supabase -
PostgreSQL - Cloudflare

### LLM Synthesis

Infer: - Primary purpose - Audience - Difficulty - Domain - Use cases -
Summary - Hidden technologies

### Embeddings

Generate embeddings for: - Semantic search - Related skills -
Recommendations - Clustering

## Suggested Metadata

- Summary
- Technologies
- Frameworks
- Languages
- AI Providers
- Domains
- Categories
- Use Cases
- Audience
- Difficulty
- Estimated token count
- Estimated reading time
- Embedding vector

## Canonical Taxonomy

Normalize variants such as:

- ReactJS
- React.js
- react

into:

- React

Apply the same normalization to all technologies.

## Suggested Features

### Discovery

- Top Installed
- Trending
- Hidden Gems
- Recently Updated
- Fastest Growing

### AI

- One-paragraph summary
- TL;DR
- Who is this for?
- Related skills
- Compare skills
- Semantic search
- AI chat

### Analytics

After collecting snapshots:

- Weekly growth
- Monthly growth
- Install history
- Sparkline charts
- Velocity rankings

### Better Sidebar

Instead of only showing installs:

- ⭐ Installs
- 🔥 Trending
- 📈 Weekly Growth
- 🏷 Tags
- 🧠 AI Summary
- 📚 Reading Time
- ⚡ Estimated Tokens
- 🎯 Difficulty
- 👥 Audience
- 🛠 Technologies
- 📦 Frameworks
- 🕒 Last Updated

## Long-Term Vision

Expand beyond Skills.sh into a unified AI capability index.

Potential future sources:

- Claude Code Skills
- Cursor Rules
- Windsurf Rules
- Cline prompts
- Roo Code modes
- GitHub Copilot instructions
- MCP servers
- Prompt collections

Model a generic **AI Capability** instead of only `SKILL.md`.

## Recommendation

Differentiate from Skills.sh by focusing on:

- AI-generated metadata
- Rich taxonomy
- Semantic search
- Related skills
- Curated collections
- Historical analytics
- Cross-ecosystem discovery

## Hackathon Strategy (24 Hours)

### Hybrid Search Strategy (Recommended)

Given the registry scale (\~900K skills), do **not** attempt to enrich
the entire corpus during the hackathon.

Instead:

1.  Fetch the registry metadata.
2.  Identify the **top \~2,000 most-installed skills**.
3.  Download and run LLM enrichment only on those 2,000 skills.
4.  Generate:
    - summaries
    - tags
    - technologies
    - use cases
    - embeddings
5.  Store embeddings in a managed vector database (e.g. Qdrant Cloud).
6.  Index **all 900K** skills (metadata only) in a keyword search engine
    (e.g. Meilisearch).

### Query Flow

```text
User Query
    │
    ├── Keyword Search (Meilisearch)
    │       └── Searches all ~900K skills
    │
    └── Semantic Search (Qdrant)
            └── Searches only the enriched top ~2,000 skills
```

Merge and rank the results:

- Exact keyword matches first.
- Semantic matches next.
- Boost highly-installed skills.
- De-duplicate identical results.

This provides excellent perceived quality while keeping implementation
realistic for a hackathon.

### Why this works

Most users search for well-known technologies (React, Next.js,
TypeScript, Cloudflare, Supabase, etc.). Those are disproportionately
represented among the most-installed skills, so enriching the head of
the distribution delivers the highest value.

The long tail remains searchable via keywords, and additional skills can
be enriched incrementally after the hackathon.

### Recommended Stack

- Next.js
- Meilisearch (all skills)
- Qdrant Cloud (top 2,000 embeddings)
- Postgres/Supabase (metadata)
- Object Storage (raw SKILL.md files)
- GPT-5 or Gemini for enrichment

## Qdrant Cloud Feasibility

### Free Tier Assessment

Qdrant Cloud Free is sufficient for the hackathon.

Current limits:

- Single node
- 0.5 vCPU
- 1 GB RAM
- 4 GB disk
- Free cloud inference (optional)

### Estimated Usage

Top 2,000 enriched skills:

- \~12 MB raw vectors (1536-dimensional float32 embeddings)
- \<100 MB total including payloads and index overhead

This comfortably fits within the free tier.

Even expanding to approximately 20,000 enriched skills should remain
well within the available resources.

### Recommended Usage

Use Qdrant only for semantic search over the enriched subset.

Do not attempt to index all 900K skills during the hackathon.

Use Meilisearch (or Typesense) for keyword search across the full
registry.

### Embedding Strategy

Do **not** embed the raw `SKILL.md`.

Instead:

1.  Run the LLM to generate structured metadata:
    - Summary
    - Technologies
    - Domains
    - Use Cases
    - Audience
    - Difficulty
2.  Create a single embedding from this distilled representation.

Benefits:

- Better semantic search quality
- Lower embedding cost
- Smaller payloads
- More stable embeddings when documentation changes

### Future Scaling

Instead of hardcoding the top 2,000 skills, make enrichment
budget-driven.

Pseudo-logic:

```ts
const MAX_ENRICHED = 2000;

if (installRank <= MAX_ENRICHED) {
  enrichWithLLM();
  generateEmbedding();
} else {
  keywordOnly();
}
```

This allows the enriched corpus to grow incrementally without changing
the architecture.
