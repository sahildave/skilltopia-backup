import type { UpdateController } from './controller';

/** Long enough after mount that the check never competes with first paint. */
export const STARTUP_DELAY_MS = 5_000;
export const PERIODIC_INTERVAL_MS = 6 * 60 * 60 * 1000;
/** A window focus only re-checks if the last successful check is older than this. */
export const FOCUS_RECHECK_AFTER_MS = 6 * 60 * 60 * 1000;

export interface UpdateSchedulerOptions {
  controller: Pick<UpdateController, 'check' | 'lastSuccessAt'>;
  startupDelayMs?: number;
  periodicIntervalMs?: number;
  focusRecheckAfterMs?: number;
  now?: () => number;
}

/**
 * The single owner of every update timer. Nothing else in the module schedules
 * work, so "when do we check" is one file to read.
 *
 * Returns the stop function; call it on unmount.
 */
export function startUpdateScheduler({
  controller,
  startupDelayMs = STARTUP_DELAY_MS,
  periodicIntervalMs = PERIODIC_INTERVAL_MS,
  focusRecheckAfterMs = FOCUS_RECHECK_AFTER_MS,
  now = Date.now,
}: UpdateSchedulerOptions): () => void {
  // Offline checks only produce network errors, and a hidden window has nobody
  // to show the result to. Skip the tick rather than queue it.
  function isPaused(): boolean {
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return true;
    return false;
  }

  const startupTimer = setTimeout(() => {
    if (!isPaused()) void controller.check('startup');
  }, startupDelayMs);

  const periodicTimer = setInterval(() => {
    if (!isPaused()) void controller.check('periodic');
  }, periodicIntervalMs);

  function handleFocus() {
    if (isPaused()) return;
    const last = controller.lastSuccessAt();
    if (last !== null && now() - last < focusRecheckAfterMs) return;
    void controller.check('focus');
  }

  window.addEventListener('focus', handleFocus);

  return () => {
    clearTimeout(startupTimer);
    clearInterval(periodicTimer);
    window.removeEventListener('focus', handleFocus);
  };
}
