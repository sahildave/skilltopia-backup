import { vi } from 'vitest';
import type { CheckReason, DownloadChunk, UpdateCandidate, UpdateSource } from '../types';

export const CANDIDATE: UpdateCandidate = {
  version: '1.2.0',
  currentVersion: '1.1.0',
  notes: 'Fixes things',
  publishedAt: '2026-08-30T00:00:00Z',
};

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
}

function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/**
 * A hand-driven `UpdateSource`: nothing settles until the test says so, which is
 * what makes in-flight behaviour observable.
 */
export function createFakeSource() {
  const checkCalls: CheckReason[] = [];
  let pendingCheck: Deferred<UpdateCandidate | null> | null = null;
  let pendingInstall: Deferred<undefined> | null = null;
  let emitChunk: ((chunk: DownloadChunk) => void) | null = null;
  const relaunch = vi.fn(() => Promise.resolve());
  const downloadAndInstall = vi.fn(
    (_candidate: UpdateCandidate, onProgress: (chunk: DownloadChunk) => void) => {
      emitChunk = onProgress;
      pendingInstall = defer<undefined>();
      return pendingInstall.promise;
    },
  );

  const source: UpdateSource = {
    check(reason) {
      checkCalls.push(reason);
      pendingCheck = defer<UpdateCandidate | null>();
      return pendingCheck.promise;
    },
    downloadAndInstall,
    relaunch,
  };

  return {
    source,
    checkCalls,
    relaunch,
    downloadAndInstall,
    resolveCheck(value: UpdateCandidate | null) {
      pendingCheck?.resolve(value);
    },
    rejectCheck(error: unknown) {
      pendingCheck?.reject(error);
    },
    emit(chunk: DownloadChunk) {
      emitChunk?.(chunk);
    },
    finishInstall() {
      pendingInstall?.resolve(undefined);
    },
    failInstall(error: unknown) {
      pendingInstall?.reject(error);
    },
  };
}
