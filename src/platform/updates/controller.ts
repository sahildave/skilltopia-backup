import { toUpdateError, type CheckReason, type UpdateSource, type UpdateState } from './types';

/** A dismissed version is offered again once this much time has passed. */
export const REOFFER_AFTER_MS = 24 * 60 * 60 * 1000;

export interface UpdateController {
  getState: () => UpdateState;
  subscribe: (listener: (state: UpdateState) => void) => () => void;
  /**
   * Run a check, or join the one already running. Resolves to the state the
   * check landed on, so a manual check can be awaited for a visible answer.
   */
  check: (reason: CheckReason) => Promise<UpdateState>;
  /** Download and install the available candidate. Ignored unless one is offered. */
  install: () => Promise<void>;
  /** Hide the current offer; suppress it until it is re-offered. */
  dismiss: () => void;
  /** Restart into the installed version. Ignored unless the install finished. */
  restart: () => Promise<void>;
  /** Epoch ms of the last check that reached the source, or null. */
  lastSuccessAt: () => number | null;
}

export interface UpdateControllerOptions {
  source: UpdateSource;
  now?: () => number;
  reofferAfterMs?: number;
}

/**
 * The whole update policy: one check at a time, one install at a time, byte
 * accumulation, and dismissal. It never touches Tauri, a timer, or the DOM —
 * timers live in the scheduler and platform calls behind `UpdateSource`.
 */
export function createUpdateController({
  source,
  now = Date.now,
  reofferAfterMs = REOFFER_AFTER_MS,
}: UpdateControllerOptions): UpdateController {
  const listeners = new Set<(state: UpdateState) => void>();
  let state: UpdateState = { status: 'idle' };
  let inFlightCheck: Promise<UpdateState> | null = null;
  let inFlightIsManual = false;
  let dismissedVersion: string | null = null;
  let dismissedAt = 0;
  let lastSuccess: number | null = null;

  function commit(next: UpdateState): UpdateState {
    state = next;
    for (const listener of listeners) listener(next);
    return next;
  }

  function isSuppressed(version: string): boolean {
    return dismissedVersion === version && now() - dismissedAt < reofferAfterMs;
  }

  async function runCheck(reason: CheckReason): Promise<UpdateState> {
    commit({ status: 'checking', reason });
    try {
      const candidate = await source.check(reason);
      lastSuccess = now();
      // A manual check joining an in-flight one has to end on a visible answer,
      // so it overrides both the suppression rule and the reported reason.
      const manual = inFlightIsManual;
      if (!candidate) return commit({ status: 'upToDate', checkedAt: lastSuccess });
      if (!manual && isSuppressed(candidate.version)) return commit({ status: 'idle' });
      return commit({ status: 'available', candidate, reason: manual ? 'manual' : reason });
    } catch (error) {
      return commit({
        status: 'failed',
        error: toUpdateError(error, 'network'),
        reason: inFlightIsManual ? 'manual' : reason,
      });
    } finally {
      inFlightCheck = null;
    }
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    check(reason) {
      // Nothing may disturb a download or a finished install waiting on restart.
      if (state.status === 'downloading' || state.status === 'readyToRestart') {
        return Promise.resolve(state);
      }
      if (inFlightCheck) {
        if (reason === 'manual') inFlightIsManual = true;
        return inFlightCheck;
      }
      inFlightIsManual = reason === 'manual';
      inFlightCheck = runCheck(reason);
      return inFlightCheck;
    },

    async install() {
      // Anything but `available` means there is no offer to act on, which also
      // makes a second click during the download a no-op.
      if (state.status !== 'available') return;
      const { candidate } = state;
      let downloadedBytes = 0;
      let totalBytes: number | null = null;
      commit({ status: 'downloading', candidate, progress: { downloadedBytes, totalBytes } });
      try {
        await source.downloadAndInstall(candidate, (chunk) => {
          downloadedBytes += chunk.chunkLength;
          if (chunk.contentLength !== null) totalBytes = chunk.contentLength;
          commit({ status: 'downloading', candidate, progress: { downloadedBytes, totalBytes } });
        });
        commit({ status: 'readyToRestart', candidate });
      } catch (error) {
        commit({ status: 'failed', error: toUpdateError(error, 'install'), reason: 'manual' });
      }
    },

    dismiss() {
      if (state.status === 'available') {
        dismissedVersion = state.candidate.version;
        dismissedAt = now();
      }
      commit({ status: 'idle' });
    },

    async restart() {
      if (state.status !== 'readyToRestart') return;
      await source.relaunch();
    },

    lastSuccessAt: () => lastSuccess,
  };
}
