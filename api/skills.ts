import {
  enforceRateLimit,
  methodNotAllowed,
  proxySkillsRequest,
} from './_lib/proxy'
import { parseSkillsLeaderboardQuery } from './_lib/query'

/**
 * Proxies GET /api/v1/skills to skills.sh using Vercel OIDC.
 * Query allowlist: view, page, per_page
 */
export async function GET(request: Request): Promise<Response> {
  const limited = enforceRateLimit(request)
  if (limited) return limited

  const parsed = parseSkillsLeaderboardQuery(new URL(request.url).searchParams)
  if (!parsed.ok) {
    return Response.json(parsed.body, { status: parsed.status })
  }

  return proxySkillsRequest('/skills', parsed.query)
}

export async function POST(): Promise<Response> {
  return methodNotAllowed()
}
