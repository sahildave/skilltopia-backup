import { describe, expect, it } from 'vitest';
import { MAX_ENRICHED, MAX_ENRICHED_DEFAULT, maxEnrichedFromEnv } from './max-enriched.js';

describe('maxEnrichedFromEnv', () => {
  it('defaults to 500 when unset and caps at 1500', () => {
    expect(maxEnrichedFromEnv({})).toBe(MAX_ENRICHED_DEFAULT);
    expect(maxEnrichedFromEnv({ MAX_ENRICHED: '20' })).toBe(20);
    expect(maxEnrichedFromEnv({ MAX_ENRICHED: '1500' })).toBe(1500);
    expect(maxEnrichedFromEnv({ MAX_ENRICHED: '9999' })).toBe(MAX_ENRICHED);
    expect(maxEnrichedFromEnv({ MAX_ENRICHED: '0' })).toBe(MAX_ENRICHED_DEFAULT);
  });
});
