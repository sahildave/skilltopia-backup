/** Canonical upstream repository for the provider registry. */
export const PROVIDER_REGISTRY_SOURCE_URL =
  'https://github.com/vercel-labs/skills'

export type ProviderPlatform = 'darwin' | 'win32' | 'linux'

/**
 * Named probes for detection / skills-dir rules that cannot be expressed as
 * ordinary path checks (see upstream `src/agents.ts` helpers).
 */
export type SpecialProbeName = 'eve-installed' | 'openclaw-skills-dir'

/** A filesystem location relative to a well-known base. */
export type PathSpec =
  | {
      base: 'home' | 'configHome' | 'cwd'
      path: string
    }
  | {
      base: 'absolute'
      path: string
      platforms?: readonly ProviderPlatform[]
    }
  | {
      /** `process.env[env]?.trim() || join(home, defaultPath)`, then optional join. */
      base: 'envHome'
      env: string
      defaultPath: string
      path?: string
    }
  | {
      /** `join(process.env[env], path)` — skipped when env is unset if optional. */
      base: 'env'
      env: string
      path: string
      optional?: boolean
      platforms?: readonly ProviderPlatform[]
    }

export type DetectionRule =
  | { type: 'paths'; match: 'any' | 'all'; paths: readonly PathSpec[] }
  | { type: 'never' }
  | { type: 'special'; name: SpecialProbeName }

export type GlobalSkillsDir =
  | { type: 'path'; path: PathSpec }
  | { type: 'none' }
  | { type: 'special'; name: 'openclaw-skills-dir' }

export type ProviderDefinition = {
  id: string
  displayName: string
  /** Project-relative skills directory (upstream `skillsDir`). */
  skillsDir: string
  /** True when `skillsDir === '.agents/skills'` (skills.sh Universal). */
  universal: boolean
  showInUniversalList: boolean
  showInUniversalPrompt: boolean
  globalSkillsDir: GlobalSkillsDir
  detection: DetectionRule
}

export type ProviderRegistrySource = {
  repositoryUrl: typeof PROVIDER_REGISTRY_SOURCE_URL
  commit: string
  license: 'MIT'
  attribution: string
  generatedAt: string
  agentsTsPath: 'src/agents.ts'
}

export type ProviderRegistry = {
  source: ProviderRegistrySource
  providers: readonly ProviderDefinition[]
}
