import { createRef } from 'react';
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useClickOutside } from './use-click-outside';

function pointerDownOn(target: Element) {
  target.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true }));
}

describe('useClickOutside', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('fires for a pointer event outside the ref', () => {
    const inside = document.createElement('div');
    const outside = document.createElement('div');
    document.body.append(inside, outside);

    const ref = createRef<HTMLDivElement>();
    ref.current = inside;
    const handler = vi.fn();
    renderHook(() => useClickOutside(ref, handler));

    pointerDownOn(outside);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores portaled menu layers so a menu inside the ref can be used', () => {
    const inside = document.createElement('div');
    const menu = document.createElement('div');
    menu.setAttribute('role', 'menu');
    const item = document.createElement('button');
    menu.append(item);
    document.body.append(inside, menu);

    const ref = createRef<HTMLDivElement>();
    ref.current = inside;
    const handler = vi.fn();
    renderHook(() => useClickOutside(ref, handler));

    pointerDownOn(item);
    expect(handler).not.toHaveBeenCalled();
  });
});
