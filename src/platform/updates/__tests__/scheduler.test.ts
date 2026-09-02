import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  FOCUS_RECHECK_AFTER_MS,
  PERIODIC_INTERVAL_MS,
  STARTUP_DELAY_MS,
  startUpdateScheduler,
} from '../scheduler';
import type { CheckReason, UpdateState } from '../types';

function fakeController(lastSuccessAt: number | null = null) {
  return {
    check: vi.fn(async (_reason: CheckReason): Promise<UpdateState> => ({ status: 'idle' })),
    lastSuccessAt: vi.fn(() => lastSuccessAt),
  };
}

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: online });
}

function setVisibility(value: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value });
}

describe('update scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setOnline(true);
    setVisibility('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('checks once shortly after mount, not immediately', () => {
    const controller = fakeController();
    const stop = startUpdateScheduler({ controller });

    vi.advanceTimersByTime(STARTUP_DELAY_MS - 1);
    expect(controller.check).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(controller.check).toHaveBeenCalledExactlyOnceWith('startup');

    stop();
  });

  it('checks again every period', () => {
    const controller = fakeController();
    const stop = startUpdateScheduler({ controller });

    vi.advanceTimersByTime(PERIODIC_INTERVAL_MS * 2);
    const reasons = controller.check.mock.calls.map(([reason]) => reason);

    expect(reasons).toEqual(['startup', 'periodic', 'periodic']);
    stop();
  });

  it('re-checks on focus only when the last success is stale', () => {
    const now = 10 * FOCUS_RECHECK_AFTER_MS;
    const fresh = fakeController(now - 1);
    const stopFresh = startUpdateScheduler({ controller: fresh, now: () => now });

    window.dispatchEvent(new Event('focus'));
    expect(fresh.check).not.toHaveBeenCalled();
    stopFresh();

    const stale = fakeController(now - FOCUS_RECHECK_AFTER_MS);
    const stopStale = startUpdateScheduler({ controller: stale, now: () => now });

    window.dispatchEvent(new Event('focus'));
    expect(stale.check).toHaveBeenCalledExactlyOnceWith('focus');
    stopStale();
  });

  it('checks on focus when nothing has ever succeeded', () => {
    const controller = fakeController(null);
    const stop = startUpdateScheduler({ controller });

    window.dispatchEvent(new Event('focus'));
    expect(controller.check).toHaveBeenCalledExactlyOnceWith('focus');

    stop();
  });

  it('pauses every trigger while offline', () => {
    setOnline(false);
    const controller = fakeController();
    const stop = startUpdateScheduler({ controller });

    vi.advanceTimersByTime(PERIODIC_INTERVAL_MS);
    window.dispatchEvent(new Event('focus'));

    expect(controller.check).not.toHaveBeenCalled();
    stop();
  });

  it('pauses every trigger while the window is hidden', () => {
    setVisibility('hidden');
    const controller = fakeController();
    const stop = startUpdateScheduler({ controller });

    vi.advanceTimersByTime(PERIODIC_INTERVAL_MS);
    window.dispatchEvent(new Event('focus'));

    expect(controller.check).not.toHaveBeenCalled();
    stop();
  });

  it('resumes once the window comes back online', () => {
    setOnline(false);
    const controller = fakeController();
    const stop = startUpdateScheduler({ controller });

    vi.advanceTimersByTime(STARTUP_DELAY_MS);
    setOnline(true);
    vi.advanceTimersByTime(PERIODIC_INTERVAL_MS);

    expect(controller.check).toHaveBeenCalledExactlyOnceWith('periodic');
    stop();
  });

  it('stops every timer and listener when stopped', () => {
    const controller = fakeController();
    const stop = startUpdateScheduler({ controller });
    stop();

    vi.advanceTimersByTime(PERIODIC_INTERVAL_MS * 3);
    window.dispatchEvent(new Event('focus'));

    expect(controller.check).not.toHaveBeenCalled();
  });
});
