import type { UpdateCandidate, UpdateSource } from './types';

/**
 * A self-driving `UpdateSource` for the `mock` target. Unlike the test
 * `fake-source`, nothing here waits to be poked: `check` reports an update is
 * available, `downloadAndInstall` streams progress on real timers, and
 * `relaunch` reloads the page. It exists so the whole update flow —
 * available → downloading → readyToRestart — is walkable in the browser via
 * `npm run dev:mock`, with no Tauri build.
 */
const MOCK_CANDIDATE: UpdateCandidate = {
  version: '9.9.9',
  currentVersion: __APP_VERSION__,
  notes: 'Mock release — exercises the update dialog end to end.',
  publishedAt: null,
};

const TOTAL_BYTES = 8 * 1024 * 1024;
const CHUNK_COUNT = 20;

export function createMockUpdateSource(): UpdateSource {
  return {
    check(_reason) {
      return new Promise((resolve) => setTimeout(() => resolve(MOCK_CANDIDATE), 600));
    },
    downloadAndInstall(_candidate, onProgress) {
      const chunkLength = Math.ceil(TOTAL_BYTES / CHUNK_COUNT);
      let sent = 0;
      return new Promise((resolve) => {
        const timer = setInterval(() => {
          const next = Math.min(chunkLength, TOTAL_BYTES - sent);
          onProgress({ chunkLength: next, contentLength: TOTAL_BYTES });
          sent += next;
          if (sent >= TOTAL_BYTES) {
            clearInterval(timer);
            setTimeout(resolve, 300);
          }
        }, 120);
      });
    },
    relaunch() {
      window.location.reload();
      return Promise.resolve();
    },
  };
}
