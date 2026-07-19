import { beforeEach, describe, expect, it, vi } from 'vitest'

const { getVercelOidcToken } = vi.hoisted(() => ({
  getVercelOidcToken: vi.fn(),
}))

vi.mock('@vercel/oidc', () => ({ getVercelOidcToken }))

import { GET as getSkills, POST as postSkills } from './skills.js'
import { GET as searchSkills } from './skills/search.js'

describe('skills proxy routes', () => {
  beforeEach(() => {
    getVercelOidcToken.mockResolvedValue('upstream-secret')
    vi.unstubAllGlobals()
  })

  it('rejects invalid leaderboard queries before contacting upstream', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const response = await getSkills(
      new Request('https://proxy.test/api/skills?per_page=501')
    )

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({
      error: 'invalid_query',
      message: 'per_page must be between 1 and 500',
    })
    expect(fetchMock).not.toHaveBeenCalled()
    expect(getVercelOidcToken).not.toHaveBeenCalled()
  })

  it('rejects unsupported methods', async () => {
    const response = await postSkills()

    expect(response.status).toBe(405)
    expect(await response.json()).toEqual({
      error: 'method_not_allowed',
      message: 'Only GET is supported.',
    })
  })

  it('forwards approved search queries and keeps upstream credentials server-side', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: {
          'Cache-Control': 'public, max-age=60',
          'X-RateLimit-Limit': '600',
          'X-RateLimit-Remaining': '599',
        },
      })
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await searchSkills(
      new Request('https://proxy.test/api/skills/search?q=react&limit=5')
    )

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ data: [] })
    expect(response.headers.get('Cache-Control')).toBe('public, max-age=60')
    expect(response.headers.get('Authorization')).toBeNull()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://skills.sh/api/v1/skills/search?q=react&limit=5',
      {
        headers: {
          Accept: 'application/json',
          Authorization: 'Bearer upstream-secret',
        },
      }
    )
  })
})
