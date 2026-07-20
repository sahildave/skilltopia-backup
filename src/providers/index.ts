import registryJson from './registry.json'
import {
  assertCanonicalSourceUrl,
  getNonUniversalProviders,
  getProviderById,
  getUniversalProviders,
  getVisibleUniversalProviders,
  isUniversalProvider,
} from './classification'
import type { ProviderRegistry } from './types'
import { PROVIDER_REGISTRY_SOURCE_URL } from './types'

export const providerRegistry = registryJson as ProviderRegistry

assertCanonicalSourceUrl(providerRegistry.source.repositoryUrl)

export {
  PROVIDER_REGISTRY_SOURCE_URL,
  assertCanonicalSourceUrl,
  getNonUniversalProviders,
  getProviderById,
  getUniversalProviders,
  getVisibleUniversalProviders,
  isUniversalProvider,
}

export type {
  DetectionRule,
  GlobalSkillsDir,
  PathSpec,
  ProviderDefinition,
  ProviderPlatform,
  ProviderRegistry,
  ProviderRegistrySource,
  SpecialProbeName,
} from './types'

export {
  createProbeContext,
  evaluateDetection,
  evaluateSpecialProbe,
  resolveGlobalSkillsDir,
  resolveOpenClawGlobalSkillsDir,
  resolvePathSpec,
} from './evaluate-detection'
export type { ProbeContext, ProbeFs } from './evaluate-detection'
