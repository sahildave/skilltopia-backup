import registryJson from './registry.json';
import {
  assertCanonicalSourceUrl,
  getNonUniversalProviders,
  getProviderById,
  getUniversalProviders,
  getVisibleUniversalProviders,
  isUniversalProvider,
  universalSkillsDirRelative,
} from './classification';
import type { ProviderRegistry } from './types';
import { PROVIDER_REGISTRY_SOURCE_URL } from './types';

export const providerRegistry = registryJson as ProviderRegistry;

assertCanonicalSourceUrl(providerRegistry.source.repositoryUrl);

export {
  PROVIDER_REGISTRY_SOURCE_URL,
  assertCanonicalSourceUrl,
  getNonUniversalProviders,
  getProviderById,
  getUniversalProviders,
  getVisibleUniversalProviders,
  isUniversalProvider,
  universalSkillsDirRelative,
};

export type {
  DetectionRule,
  GlobalSkillsDir,
  PathSpec,
  ProviderDefinition,
  ProviderPlatform,
  ProviderRegistry,
  ProviderRegistrySource,
  SpecialProbeName,
} from './types';

// Detection helpers use node:os / node:path — import from
// `@/providers/evaluate-detection` (Node/tests only), never this barrel.
