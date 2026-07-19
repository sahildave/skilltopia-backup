import { methodNotAllowed, proxySkillsRequest } from '../_lib/proxy'

/**
 * Proxies GET /api/v1/skills/search to skills.sh using Vercel OIDC.
 * Query: q, limit, owner
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  return proxySkillsRequest('/skills/search', searchParams)
}

export async function POST(): Promise<Response> {
  return methodNotAllowed()
}
