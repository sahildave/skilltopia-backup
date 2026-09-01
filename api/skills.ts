import { hydrateCatalogSkills } from './_lib/catalog-metadata.js';
import {
  createSupabaseRepositoryFromEnv,
  type SkillMetadataRecord,
} from './_lib/supabase-repository.js';
import { enforceRateLimit, methodNotAllowed, proxySkillsRequest } from './_lib/proxy.js';
import { parseSkillsLeaderboardQuery } from './_lib/query.js';

/**
 * Proxies GET /api/v1/skills to skills.sh using Vercel OIDC.
 * Query allowlist: view, page, per_page
 */
export async function GET(request: Request): Promise<Response> {
  const limited = enforceRateLimit(request);
  if (limited) return limited;

  const parsed = parseSkillsLeaderboardQuery(new URL(request.url).searchParams);
  if (!parsed.ok) {
    return Response.json(parsed.body, { status: parsed.status });
  }

  const upstream = await proxySkillsRequest('/skills', parsed.query);
  if (!upstream.ok) return upstream;

  const body = (await upstream.json()) as { data?: unknown; [key: string]: unknown };
  const skills = (Array.isArray(body.data) ? body.data : []).filter(
    (skill): skill is { id: string } =>
      typeof skill === 'object' && skill !== null && 'id' in skill && typeof skill.id === 'string',
  );

  let metadata: SkillMetadataRecord[] = [];
  try {
    const repository = createSupabaseRepositoryFromEnv();
    metadata = await repository.getSkillMetadata(skills.map((skill) => skill.id));
  } catch {
    // Catalog discovery must remain available when enrichment is temporarily unavailable.
  }

  const headers = new Headers(upstream.headers);
  headers.set('Content-Type', 'application/json');
  return new Response(
    JSON.stringify({
      ...body,
      data: hydrateCatalogSkills(skills, metadata),
    }),
    {
      status: upstream.status,
      headers,
    },
  );
}

export async function POST(): Promise<Response> {
  return methodNotAllowed();
}
