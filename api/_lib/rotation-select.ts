/** Daily rotation slot mix (before queued extras). Total = 200. */
export const ROTATION_SLOTS = {
  top: 20,
  hot: 10,
  trending: 10,
  oldest: 160,
} as const;

export const ROTATION_SLOT_TOTAL =
  ROTATION_SLOTS.top + ROTATION_SLOTS.hot + ROTATION_SLOTS.trending + ROTATION_SLOTS.oldest;

export type RotationSlotInputs = {
  top: string[];
  hot: string[];
  trending: string[];
  /** Oldest `page_scraped_at` first (nulls first). */
  oldest: string[];
  /** New list members — always included, even beyond the 200 slots. */
  queued: string[];
};

/**
 * Build the daily detail/scrape queue: 20 top + 10 hot + 10 trending + 160
 * oldest, deduped by skill id, then append any queued ids not already selected.
 */
export function selectRotationIds(inputs: RotationSlotInputs): string[] {
  const selected: string[] = [];
  const seen = new Set<string>();

  function take(ids: string[], quota: number): void {
    let taken = 0;
    for (const id of ids) {
      if (taken >= quota) break;
      if (seen.has(id)) continue;
      seen.add(id);
      selected.push(id);
      taken += 1;
    }
  }

  take(inputs.top, ROTATION_SLOTS.top);
  take(inputs.hot, ROTATION_SLOTS.hot);
  take(inputs.trending, ROTATION_SLOTS.trending);
  take(inputs.oldest, ROTATION_SLOTS.oldest);

  for (const id of inputs.queued) {
    if (seen.has(id)) continue;
    seen.add(id);
    selected.push(id);
  }

  return selected;
}
