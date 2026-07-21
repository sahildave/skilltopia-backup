import { getVercelOidcToken } from '@vercel/oidc';
import { resolveSkillAudits, type SkillAuditsPayload } from '../_lib/audit-cache.js';
import { enforceRateLimit, methodNotAllowed } from '../_lib/proxy.js';
import { parseSkillDetailQuery } from '../_lib/query.js';
import { fetchSkillAudits } from '../_lib/skills-catalog.js';
import { createSupabaseRepositoryFromEnv } from '../_lib/supabase-repository.js';

async function fetchAuditsWithAppOidc(skillId: string): Promise<SkillAuditsPayload | null> {
  return fetchSkillAudits(skillId, async (url) => {
    const token = await getVercelOidcToken();
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) throw new Error(`skills.sh request failed: ${response.status}`);
    return response.json();
  });
}

/**
 * On-demand skills.sh /audit with Supabase cache (app OIDC).
 * Fresh cache skips upstream; miss/stale returns audits first and persists async.
 */
export async function GET(request: Request): Promise<Response> {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  const parsed = parseSkillDetailQuery(new URL(request.url).searchParams);
  if (!parsed.ok) return Response.json(parsed.body, { status: parsed.status });

  const skillId = parsed.query.get('skill_id');
  if (!skillId) return Response.json({ error: 'invalid_query' }, { status: 400 });

  const repository = createSupabaseRepositoryFromEnv();
  const result = await resolveSkillAudits({
    skillId,
    repository,
    fetchAudits: fetchAuditsWithAppOidc,
  });

  return Response.json(
    { data: result },
    {
      headers: {
        'Cache-Control': result.source === 'cache' ? 'public, max-age=300' : 'public, max-age=60',
      },
    },
  );
}

export async function POST(): Promise<Response> {
  return methodNotAllowed();
}
