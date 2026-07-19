import { beforeEach, describe, expect, it } from 'vitest'
import { createRateLimiter } from './rate-limit.js'

describe('createRateLimiter', () => {
  let consume: ReturnType<typeof createRateLimiter>

  beforeEach(() => {
    consume = createRateLimiter({ limit: 3, windowMs: 60_000 })
  })

  it('allows requests under the limit', () => {
    const now = 1_000_000
    expect(consume('1.1.1.1', now)).toMatchObject({
      ok: true,
      remaining: 2,
    })
    expect(consume('1.1.1.1', now + 1)).toMatchObject({
      ok: true,
      remaining: 1,
    })
    expect(consume('1.1.1.1', now + 2)).toMatchObject({
      ok: true,
      remaining: 0,
    })
  })

  it('rejects when the limit is exceeded', () => {
    const now = 1_000_000
    consume('1.1.1.1', now)
    consume('1.1.1.1', now)
    consume('1.1.1.1', now)

    const blocked = consume('1.1.1.1', now + 10)
    expect(blocked).toMatchObject({
      ok: false,
      remaining: 0,
    })
    if (blocked.ok) return
    expect(blocked.retryAfterSec).toBeGreaterThan(0)
  })

  it('tracks keys independently', () => {
    const now = 1_000_000
    consume('1.1.1.1', now)
    consume('1.1.1.1', now)
    consume('1.1.1.1', now)

    expect(consume('2.2.2.2', now).ok).toBe(true)
  })

  it('resets after the window elapses', () => {
    const now = 1_000_000
    consume('1.1.1.1', now)
    consume('1.1.1.1', now)
    consume('1.1.1.1', now)
    expect(consume('1.1.1.1', now).ok).toBe(false)

    expect(consume('1.1.1.1', now + 60_000).ok).toBe(true)
  })
})
