import { describe, expect, it } from 'vitest';
import { assertSeedSize, SEED_MAX_BYTES } from '../scripts/seed-utils.mjs';

describe('seed size guard', () => {
  it('allows artifacts at or below the cap', () => {
    expect(() => assertSeedSize(SEED_MAX_BYTES)).not.toThrow();
  });

  it('fails artifacts above the cap', () => {
    expect(() => assertSeedSize(SEED_MAX_BYTES + 1)).toThrow(/maximum is 256000/);
  });
});
