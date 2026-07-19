import {
  enforceRateLimit,
  methodNotAllowed,
  proxySkillsRequest,
} from '../_lib/proxy'
import { parseSkillsSearchQuery } from '../_lib/query'

/**
 * Proxies GET /api/v1/skills/search to skills.sh using Vercel OIDC.
 * Query allowlist: q, limit, owner
 */
export async function GET(request: Request): Promise<Response> {
  const limited = enforceRateLimit(request)
  if (limited) return limited

  const parsed = parseSkillsSearchQuery(new URL(request.url).searchParams)
  if (!parsed.ok) {
    return Response.json(parsed.body, { status: parsed.status })
  }

  return proxySkillsRequest('/skills/search', parsed.query)
}

export async function POST(): Promise<Response> {
  return methodNotAllowed()
}
