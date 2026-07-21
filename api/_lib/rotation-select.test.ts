import { describe, expect, it } from 'vitest';
import { ROTATION_SLOTS, selectRotationIds } from './rotation-select.js';

describe('selectRotationIds', () => {
  it('fills locked slot mix and dedupes overlapping ids', () => {
    const top = Array.from({ length: 30 }, (_, i) => `top/${i}`);
    const hot = ['top/0', 'top/1', ...Array.from({ length: 20 }, (_, i) => `hot/${i}`)];
    const trending = ['hot/0', ...Array.from({ length: 20 }, (_, i) => `trend/${i}`)];
    const oldest = Array.from({ length: 200 }, (_, i) => `old/${i}`);

    const selected = selectRotationIds({ top, hot, trending, oldest, queued: [] });

    expect(selected).toHaveLength(
      ROTATION_SLOTS.top + ROTATION_SLOTS.hot + ROTATION_SLOTS.trending + ROTATION_SLOTS.oldest,
    );
    expect(new Set(selected).size).toBe(selected.length);
    expect(selected.slice(0, ROTATION_SLOTS.top)).toEqual(top.slice(0, ROTATION_SLOTS.top));
    // hot skips top/0 and top/1 already taken
    expect(selected.slice(ROTATION_SLOTS.top, ROTATION_SLOTS.top + ROTATION_SLOTS.hot)).toEqual(
      Array.from({ length: ROTATION_SLOTS.hot }, (_, i) => `hot/${i}`),
    );
  });

  it('always appends new queued members beyond the 200-slot mix', () => {
    const top = Array.from({ length: 20 }, (_, i) => `top/${i}`);
    const hot = Array.from({ length: 10 }, (_, i) => `hot/${i}`);
    const trending = Array.from({ length: 10 }, (_, i) => `trend/${i}`);
    const oldest = Array.from({ length: 160 }, (_, i) => `old/${i}`);
    const queued = ['top/0', 'new/a', 'new/b'];

    const selected = selectRotationIds({ top, hot, trending, oldest, queued });

    expect(selected).toHaveLength(200 + 2);
    expect(selected).toContain('new/a');
    expect(selected).toContain('new/b');
    expect(selected.filter((id) => id === 'top/0')).toHaveLength(1);
  });
});
