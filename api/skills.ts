import { methodNotAllowed, proxySkillsRequest } from './_lib/proxy'

/**
 * Proxies GET /api/v1/skills to skills.sh using Vercel OIDC.
 * Query: view, page, per_page
 */
export async function GET(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url)
  return proxySkillsRequest('/skills', searchParams)
}

export async function POST(): Promise<Response> {
  return methodNotAllowed()
}
