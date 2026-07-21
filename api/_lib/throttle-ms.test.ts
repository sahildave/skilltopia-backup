import { describe, expect, it } from 'vitest';
import {
  THROTTLE_MS_DEFAULT,
  THROTTLE_MS_SWEEP_DEFAULT,
  throttleMsFromEnv,
} from './throttle-ms.js';

describe('throttleMsFromEnv', () => {
  it('defaults to fallback when unset or invalid', () => {
    expect(throttleMsFromEnv({})).toBe(THROTTLE_MS_DEFAULT);
    expect(throttleMsFromEnv({}, THROTTLE_MS_SWEEP_DEFAULT)).toBe(THROTTLE_MS_SWEEP_DEFAULT);
    expect(throttleMsFromEnv({ THROTTLE_MS: 'nope' })).toBe(THROTTLE_MS_DEFAULT);
    expect(throttleMsFromEnv({ THROTTLE_MS: '-1' })).toBe(THROTTLE_MS_DEFAULT);
  });

  it('accepts 0 and positive integers', () => {
    expect(throttleMsFromEnv({ THROTTLE_MS: '0' })).toBe(0);
    expect(throttleMsFromEnv({ THROTTLE_MS: '250' })).toBe(250);
    expect(throttleMsFromEnv({ THROTTLE_MS: '1000' })).toBe(1000);
  });
});
