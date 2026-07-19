import { getVercelOidcToken } from '@vercel/oidc'

const SKILLS_API_BASE = 'https://skills.sh/api/v1'

export async function proxySkillsRequest(
  path: string,
  searchParams: URLSearchParams
): Promise<Response> {
  const token = await getVercelOidcToken()
  const query = searchParams.toString()
  const url = `${SKILLS_API_BASE}${path}${query ? `?${query}` : ''}`

  const upstream = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })

  const body = await upstream.text()
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control':
      upstream.headers.get('Cache-Control') ?? 'public, max-age=30',
  })

  const limit = upstream.headers.get('X-RateLimit-Limit')
  const remaining = upstream.headers.get('X-RateLimit-Remaining')
  const reset = upstream.headers.get('X-RateLimit-Reset')
  const retryAfter = upstream.headers.get('Retry-After')
  if (limit) headers.set('X-RateLimit-Limit', limit)
  if (remaining) headers.set('X-RateLimit-Remaining', remaining)
  if (reset) headers.set('X-RateLimit-Reset', reset)
  if (retryAfter) headers.set('Retry-After', retryAfter)

  return new Response(body, {
    status: upstream.status,
    headers,
  })
}

export function methodNotAllowed(): Response {
  return Response.json(
    { error: 'method_not_allowed', message: 'Only GET is supported.' },
    { status: 405 }
  )
}
