import type { ProviderDefinition, ProviderRegistry } from './types'
import { PROVIDER_REGISTRY_SOURCE_URL } from './types'

export function isUniversalProvider(provider: ProviderDefinition): boolean {
  return provider.universal
}

/** Agents that use `.agents/skills`, excluding `showInUniversalList: false`. */
export function getUniversalProviders(
  registry: ProviderRegistry
): ProviderDefinition[] {
  return registry.providers.filter(
    provider => provider.universal && provider.showInUniversalList !== false
  )
}

/**
 * Universal agents shown in the interactive locked section.
 * Mirrors upstream `getVisibleUniversalAgents`.
 */
export function getVisibleUniversalProviders(
  registry: ProviderRegistry
): ProviderDefinition[] {
  return registry.providers.filter(
    provider =>
      provider.universal &&
      provider.showInUniversalList !== false &&
      provider.showInUniversalPrompt !== false
  )
}

/** Agents that use agent-specific skill directories (not universal). */
export function getNonUniversalProviders(
  registry: ProviderRegistry
): ProviderDefinition[] {
  return registry.providers.filter(provider => !provider.universal)
}

export function getProviderById(
  registry: ProviderRegistry,
  id: string
): ProviderDefinition | undefined {
  return registry.providers.find(provider => provider.id === id)
}

export function assertCanonicalSourceUrl(url: string): void {
  if (url !== PROVIDER_REGISTRY_SOURCE_URL) {
    throw new Error(
      `Expected canonical source URL ${PROVIDER_REGISTRY_SOURCE_URL}, got ${url}`
    )
  }
}
