export type RateLimitConfig = {
  limit: number
  windowMs: number
}

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number }
  | {
      ok: false
      remaining: 0
      resetAt: number
      retryAfterSec: number
    }

type Bucket = {
  count: number
  resetAt: number
}

/** Default: 60 req/min per IP — well under shared OIDC 600/min quota. */
export const PROXY_RATE_LIMIT = 60
export const PROXY_RATE_WINDOW_MS = 60_000

/** Fixed-window in-memory limiter. Best-effort across Fluid Compute instances. */
export function createRateLimiter(config: RateLimitConfig) {
  const buckets = new Map<string, Bucket>()

  return function consume(key: string, now = Date.now()): RateLimitResult {
    const existing = buckets.get(key)
    if (!existing || now >= existing.resetAt) {
      const resetAt = now + config.windowMs
      buckets.set(key, { count: 1, resetAt })
      return { ok: true, remaining: config.limit - 1, resetAt }
    }

    if (existing.count >= config.limit) {
      const retryAfterSec = Math.max(
        1,
        Math.ceil((existing.resetAt - now) / 1000)
      )
      return {
        ok: false,
        remaining: 0,
        resetAt: existing.resetAt,
        retryAfterSec,
      }
    }

    existing.count += 1
    return {
      ok: true,
      remaining: config.limit - existing.count,
      resetAt: existing.resetAt,
    }
  }
}

export const proxyRateLimit = createRateLimiter({
  limit: PROXY_RATE_LIMIT,
  windowMs: PROXY_RATE_WINDOW_MS,
})

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  return 'unknown'
}
