import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { catalog as mockCatalog } from './index.mock'
import { catalog as webCatalog } from './index.web'
import { MOCK_DETAIL, MOCK_LEADERBOARD } from './fixtures'

describe('CatalogPort mock', () => {
  it('returns fixture leaderboard capped by perPage', async () => {
    const skills = await mockCatalog.fetchLeaderboard('all-time', 0, 1)
    expect(skills).toEqual([MOCK_LEADERBOARD[0]])
  })

  it('filters search results by name', async () => {
    const skills = await mockCatalog.search('frontend', 10)
    expect(skills).toEqual([MOCK_LEADERBOARD[1]])
  })

  it('returns fixture detail for known skill id', async () => {
    const detail = await mockCatalog.fetchDetail(MOCK_DETAIL.skillId)
    expect(detail).toEqual(MOCK_DETAIL)
  })
})

describe('CatalogPort web', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('fetches leaderboard from relative /api/skills', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: MOCK_LEADERBOARD }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const skills = await webCatalog.fetchLeaderboard('trending', 0, 12)

    expect(fetch).toHaveBeenCalledWith(
      '/api/skills?view=trending&page=0&per_page=12'
    )
    expect(skills).toEqual(MOCK_LEADERBOARD)
  })

  it('fetches search from relative /api/skills/search', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [MOCK_LEADERBOARD[0]] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    )

    const skills = await webCatalog.search('find', 50)

    expect(fetch).toHaveBeenCalledWith('/api/skills/search?q=find&limit=50')
    expect(skills).toEqual([MOCK_LEADERBOARD[0]])
  })

  it('throws when the catalog response is not ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('nope', { status: 503, statusText: 'Service Unavailable' })
    )

    await expect(
      webCatalog.fetchLeaderboard('all-time', 0, 10)
    ).rejects.toThrow(/503/)
  })
})
