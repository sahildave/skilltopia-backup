import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { platform as mockPlatform } from './index.mock'
import { platform as webPlatform } from './index.web'
import { MOCK_INSTALLED_SKILLS } from './fixtures'

describe('PlatformPort mock', () => {
  it('reports a local library and returns fixture installs', async () => {
    expect(mockPlatform.hasLocalLibrary).toBe(true)
    await expect(mockPlatform.listInstalled()).resolves.toEqual(
      MOCK_INSTALLED_SKILLS
    )
  })

  it('lists mock providers', async () => {
    const providers = await mockPlatform.listProviders()
    expect(providers.length).toBeGreaterThan(0)
    expect(providers[0]).toMatchObject({ id: expect.any(String) })
  })

  it('accepts mocked install without throwing', async () => {
    await expect(
      mockPlatform.install(
        { id: 'vercel-labs/agent-skills/find-skills', name: 'Find Skills' },
        'global'
      )
    ).resolves.toBeUndefined()
  })
})

describe('PlatformPort web', () => {
  beforeEach(() => {
    vi.spyOn(window, 'open').mockReturnValue(null)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not claim a local library', () => {
    expect(webPlatform.hasLocalLibrary).toBe(false)
  })

  it('returns an empty installed list', async () => {
    await expect(webPlatform.listInstalled()).resolves.toEqual([])
  })

  it('opens external urls in a new tab', async () => {
    await webPlatform.openExternal('https://skills.sh')
    expect(window.open).toHaveBeenCalledWith(
      'https://skills.sh',
      '_blank',
      'noopener,noreferrer'
    )
  })
})
