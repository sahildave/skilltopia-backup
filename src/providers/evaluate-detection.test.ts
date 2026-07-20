import { describe, expect, it } from 'vitest'
import { getProviderById, providerRegistry, type ProviderDefinition } from './index'
import {
  createProbeContext,
  evaluateDetection,
  resolveGlobalSkillsDir,
  resolveOpenClawGlobalSkillsDir,
} from './evaluate-detection'

function requireProvider(id: string): ProviderDefinition {
  const provider = getProviderById(providerRegistry, id)
  expect(provider).toBeDefined()
  if (!provider) throw new Error(`missing provider ${id}`)
  return provider
}

function contextWithPaths(
  existing: string[],
  overrides: Parameters<typeof createProbeContext>[0] = {}
) {
  const paths = new Set(existing)
  return createProbeContext({
    home: '/home/user',
    cwd: '/proj',
    platform: 'darwin',
    env: {},
    ...overrides,
    fs: {
      pathExists: path => paths.has(path),
      readFile: path => {
        if (path === '/proj/package.json') {
          return JSON.stringify({ dependencies: { eve: '1.0.0' } })
        }
        throw new Error(`unexpected read: ${path}`)
      },
      ...overrides.fs,
    },
  })
}

describe('detection probe parity', () => {
  it('detects ordinary home-directory providers', () => {
    const cursor = requireProvider('cursor')
    expect(
      evaluateDetection(
        cursor.detection,
        contextWithPaths(['/home/user/.cursor'])
      )
    ).toBe(true)
    expect(evaluateDetection(cursor.detection, contextWithPaths([]))).toBe(
      false
    )
  })

  it('uses configHome (XDG) for amp detection and skills dir', () => {
    const amp = requireProvider('amp')
    const ctx = contextWithPaths(['/xdg/amp'], {
      env: { XDG_CONFIG_HOME: '/xdg' },
    })
    expect(evaluateDetection(amp.detection, ctx)).toBe(true)
    expect(resolveGlobalSkillsDir(amp.globalSkillsDir, ctx)).toBe(
      '/xdg/agents/skills'
    )
  })

  it('honors CLAUDE_CONFIG_DIR for claude-code', () => {
    const claude = requireProvider('claude-code')
    const ctx = contextWithPaths(['/custom/claude'], {
      env: { CLAUDE_CONFIG_DIR: '/custom/claude' },
    })
    expect(evaluateDetection(claude.detection, ctx)).toBe(true)
    expect(resolveGlobalSkillsDir(claude.globalSkillsDir, ctx)).toBe(
      '/custom/claude/skills'
    )
  })

  it('detects openclaw via legacy homes and resolves skills dir preferentially', () => {
    const openclaw = requireProvider('openclaw')
    expect(
      evaluateDetection(
        openclaw.detection,
        contextWithPaths(['/home/user/.clawdbot'])
      )
    ).toBe(true)

    const legacy = contextWithPaths(['/home/user/.moltbot'])
    expect(resolveOpenClawGlobalSkillsDir(legacy)).toBe(
      '/home/user/.moltbot/skills'
    )
    expect(resolveGlobalSkillsDir(openclaw.globalSkillsDir, legacy)).toBe(
      '/home/user/.moltbot/skills'
    )

    const preferred = contextWithPaths([
      '/home/user/.openclaw',
      '/home/user/.clawdbot',
    ])
    expect(resolveOpenClawGlobalSkillsDir(preferred)).toBe(
      '/home/user/.openclaw/skills'
    )
  })

  it('detects zcode via home dir or Applications path', () => {
    const zcode = requireProvider('zcode')
    expect(
      evaluateDetection(
        zcode.detection,
        contextWithPaths(['/Applications/ZCode.app'], { platform: 'linux' })
      )
    ).toBe(true)
    expect(
      evaluateDetection(
        zcode.detection,
        contextWithPaths(['/home/user/.zcode'], { platform: 'win32' })
      )
    ).toBe(true)
  })

  it('detects zed via configHome or optional Windows APPDATA', () => {
    const zed = requireProvider('zed')
    expect(
      evaluateDetection(
        zed.detection,
        contextWithPaths(['/home/user/.config/zed'])
      )
    ).toBe(true)

    const appData = '/Users/a/AppData/Roaming'
    const windows = contextWithPaths([`${appData}/Zed`], {
      platform: 'win32',
      env: { APPDATA: appData },
    })
    expect(evaluateDetection(zed.detection, windows)).toBe(true)

    expect(
      evaluateDetection(
        zed.detection,
        contextWithPaths([], {
          platform: 'win32',
          env: {},
        })
      )
    ).toBe(false)
  })

  it('uses the eve-installed special probe for package.json dependency', () => {
    const eve = requireProvider('eve')
    expect(eve.detection).toEqual({
      type: 'special',
      name: 'eve-installed',
    })
    expect(
      evaluateDetection(eve.detection, contextWithPaths(['/proj/agent']))
    ).toBe(true)
    expect(evaluateDetection(eve.detection, contextWithPaths([]))).toBe(false)
  })

  it('never detects the synthetic universal provider', () => {
    const universal = requireProvider('universal')
    expect(universal.detection).toEqual({ type: 'never' })
    expect(
      evaluateDetection(universal.detection, contextWithPaths(['/anything']))
    ).toBe(false)
  })
})
