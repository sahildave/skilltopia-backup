import type { SkillTargetResult, SkillTargetsResult } from '@/platform/types';
import { getProviderById, providerRegistry } from '@/providers';

/** Statuses where the target ended up in the state the user asked for. */
const SETTLED_STATUSES = new Set(['written', 'already_present', 'removed', 'absent']);

export interface TargetOutcomeSummary {
  settled: number;
  unsettled: number;
  /** Comma-joined provider names for the targets that did not work out. */
  issues: string;
  /** First message from an unsettled target, for a toast description. */
  firstMessage?: string;
}

function providerLabel(providerId: string): string {
  return getProviderById(providerRegistry, providerId)?.displayName ?? providerId;
}

/**
 * Fold independent per-target outcomes into the three cases a toast can show:
 * all good, partial, or nothing landed. An empty result set (the web adapter,
 * which only copies a command) counts as all good.
 */
export function summarizeTargetResults(result: SkillTargetsResult): TargetOutcomeSummary {
  const unsettled: SkillTargetResult[] = result.results.filter(
    (entry) => !SETTLED_STATUSES.has(entry.status),
  );
  return {
    settled: result.results.length - unsettled.length,
    unsettled: unsettled.length,
    issues: unsettled.map((entry) => providerLabel(entry.providerId)).join(', '),
    firstMessage: unsettled.find((entry) => entry.message)?.message,
  };
}
