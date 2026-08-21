import { getVercelOidcToken } from '@vercel/oidc';
import { clientIp, PROXY_RATE_LIMIT, proxyRateLimit } from './rate-limit.js';
import { createCatalogFetcher } from './skills-catalog.js';

const SKILLS_API_BASE = 'https://skills.sh/api/v1';

/**
 * Catalog fetcher for user-facing routes. Routes that need parsed catalog data
 * rather than a passthrough response (e.g. seed) must use this, not the batch
 * `fetchJson` — the app project has no batch token, so batch auth 401s here.
 */
export const fetchAppCatalogJson = createCatalogFetcher(getVercelOidcToken);

export async function proxySkillsRequest(
  path: string,
  searchParams: URLSearchParams,
): Promise<Response> {
  const token = await getVercelOidcToken();
  const query = searchParams.toString();
  const url = `${SKILLS_API_BASE}${path}${query ? `?${query}` : ''}`;

  const upstream = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  });

  const body = await upstream.text();
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': upstream.headers.get('Cache-Control') ?? 'public, max-age=30',
  });

  const limit = upstream.headers.get('X-RateLimit-Limit');
  const remaining = upstream.headers.get('X-RateLimit-Remaining');
  const reset = upstream.headers.get('X-RateLimit-Reset');
  const retryAfter = upstream.headers.get('Retry-After');
  if (limit) headers.set('X-RateLimit-Limit', limit);
  if (remaining) headers.set('X-RateLimit-Remaining', remaining);
  if (reset) headers.set('X-RateLimit-Reset', reset);
  if (retryAfter) headers.set('Retry-After', retryAfter);

  return new Response(body, {
    status: upstream.status,
    headers,
  });
}

export function methodNotAllowed(): Response {
  return Response.json(
    { error: 'method_not_allowed', message: 'Only GET is supported.' },
    { status: 405 },
  );
}

export function enforceRateLimit(request: Request): Response | null {
  const result = proxyRateLimit(clientIp(request));
  if (result.ok) return null;

  return Response.json(
    {
      error: 'rate_limited',
      message: 'Too many requests. Try again shortly.',
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfterSec),
        'X-RateLimit-Limit': String(PROXY_RATE_LIMIT),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      },
    },
  );
}
