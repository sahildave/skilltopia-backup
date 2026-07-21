import { enforceRateLimit, methodNotAllowed } from '../_lib/proxy.js';
import { parseSkillPageCacheBatchQuery } from '../_lib/query.js';
import { createSupabaseRepositoryFromEnv } from '../_lib/supabase-repository.js';

/**
 * Batch page-cache lookup for coverage / ops.
 * Query allowlist: skill_ids (comma-separated, max 100)
 */
export async function GET(request: Request): Promise<Response> {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  const parsed = parseSkillPageCacheBatchQuery(new URL(request.url).searchParams);
  if (!parsed.ok) return Response.json(parsed.body, { status: parsed.status });

  const repository = createSupabaseRepositoryFromEnv();
  const rows = await repository.listSkillPageCaches(parsed.skillIds);
  const byId = new Map(rows.map((row) => [row.skillId, row]));

  // Preserve request order; missing metadata → null snapshot (uncached).
  const data = parsed.skillIds.map((skillId) => {
    const row = byId.get(skillId);
    if (!row) {
      return {
        skillId,
        pageSnapshot: null,
        pageScrapedAt: null,
        repository: null,
        source: null,
        installCount: null,
        sourceUrl: null,
      };
    }
    return row;
  });

  return Response.json({ data });
}

export async function POST(): Promise<Response> {
  return methodNotAllowed();
}
