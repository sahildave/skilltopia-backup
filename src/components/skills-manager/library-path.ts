import type { InstalledScanSnapshot, ScanWarning } from '@/platform/types';
import { UNIVERSAL_PROVIDER_ID } from '@/platform/types';
import {
  ALL_AGENTS_FILTER_ID,
  buildProviderSidebarModel,
  type ProviderFilterId,
} from './installed-skills-model';

export function warningKey(warning: ScanWarning): string {
  return `${warning.code}-${warning.providerId ?? ''}-${warning.path ?? ''}`;
}

export function resolveSelectedPath(
  snapshot: InstalledScanSnapshot,
  selection: ProviderFilterId,
): {
  skillsDir: string | null;
  skillsDirExists: boolean;
  revealId: string;
} | null {
  if (selection === ALL_AGENTS_FILTER_ID) {
    return null;
  }
  if (selection === UNIVERSAL_PROVIDER_ID) {
    return {
      skillsDir: snapshot.universal.skillsDir,
      skillsDirExists: snapshot.universal.skillsDirExists,
      revealId: UNIVERSAL_PROVIDER_ID,
    };
  }
  const model = buildProviderSidebarModel(snapshot);
  const item =
    model.activeProviders.find((p) => p.id === selection) ??
    model.inactiveProviders.find((p) => p.id === selection);
  if (!item) {
    return { skillsDir: null, skillsDirExists: false, revealId: selection };
  }
  return {
    skillsDir: item.skillsDir,
    skillsDirExists: item.skillsDirExists,
    revealId: selection,
  };
}

export function emptyMessage(selection: ProviderFilterId, t: (key: string) => string): string {
  if (selection === ALL_AGENTS_FILTER_ID) {
    return t('skills.installed.emptyAll');
  }
  if (selection === UNIVERSAL_PROVIDER_ID) {
    return t('skills.installed.emptyUniversal');
  }
  return t('skills.installed.emptyProvider');
}
