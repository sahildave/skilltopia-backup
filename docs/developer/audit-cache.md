# Skill audit API cache

On-demand and batch access to skills.sh **`GET /api/v1/skills/audit/{id}`**, with
Supabase persistence on `skill_metadata.audits` / `audits_fetched_at`.

## Backend route

```text
GET /api/skills/audit?skill_id=owner/repo/skill
```

- Reuses the detail query allowlist (`skill_id` only) and IP rate limit.
- Uses **app** Vercel OIDC (`getVercelOidcToken`) for upstream calls.
- Fresh cache (audits present and `audits_fetched_at` within **7 days**) returns
  without contacting skills.sh (`data.source: "cache"`).
- Miss or stale: fetch upstream, **respond with audits first**, then fire-and-forget
  `upsertSkillAudits` so Supabase latency never blocks the client.

Response shape:

```ts
{
  data: {
    skillId: string;
    audits: SkillAuditsPayload | null; // null when upstream 404
    source: 'cache' | 'upstream';
    auditsFetchedAt: string | null;
  }
}
```

## Batch helper

`refreshSkillAuditsIfNeeded` (in `api/_lib/audit-cache.ts`) is used by the local
scrape pipeline after metadata upsert. It refreshes when:

- content hash changed vs the pre-upsert hash, or
- audits missing, or
- `audits_fetched_at` older than 7 days.

## Client

- CatalogPort: `fetchAudits(skillId)`
- TanStack: `useSkillAudits` / `skillsShQueryKeys.audits(skillId)` (10m staleTime)

Detail dialog UI wiring is task-5.
