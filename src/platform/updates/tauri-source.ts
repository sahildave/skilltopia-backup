import { relaunch } from '@tauri-apps/plugin-process';
import { check as pluginCheck, type CheckOptions } from '@tauri-apps/plugin-updater';
import {
  UpdateSourceError,
  type UpdateCandidate,
  type UpdateErrorCode,
  type UpdateSource,
} from './types';

/** The plugin can hang on a dead endpoint; bound it ourselves rather than trust it. */
export const CHECK_TIMEOUT_MS = 15_000;

export interface TauriUpdateSourceOptions {
  /** Only an authenticated feed needs these. A public feed must pass none. */
  requestHeaders?: Record<string, string>;
  timeoutMs?: number;
}

function classify(error: unknown): UpdateErrorCode {
  const message = error instanceof Error ? error.message : String(error);
  if (/signature|verif/i.test(message)) return 'signature';
  if (/timed?\s?out|timeout/i.test(message)) return 'timeout';
  if (/malformed|invalid|parse|expected value|json/i.test(message)) return 'malformed';
  if (/network|connect|dns|fetch|request|offline/i.test(message)) return 'network';
  return 'unknown';
}

function asSourceError(error: unknown, fallback: UpdateErrorCode): UpdateSourceError {
  if (error instanceof UpdateSourceError) return error;
  const message = error instanceof Error ? error.message : String(error);
  const code = classify(error);
  return new UpdateSourceError(code === 'unknown' ? fallback : code, message);
}

function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const bound = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new UpdateSourceError('timeout', `update check timed out after ${timeoutMs}ms`)),
      timeoutMs,
    );
  });
  return Promise.race([work, bound]).finally(() => clearTimeout(timer));
}

/**
 * `UpdateSource` over `@tauri-apps/plugin-updater`.
 *
 * The plugin's `Update` is a Rust resource handle, so every path that opens one
 * closes it: fields are copied into a plain `UpdateCandidate` and the handle is
 * released before the caller sees it. Installing re-opens a handle, because the
 * one from the check is long gone by the time the user clicks.
 */
export function createTauriUpdateSource({
  requestHeaders,
  timeoutMs = CHECK_TIMEOUT_MS,
}: TauriUpdateSourceOptions = {}): UpdateSource {
  const checkOptions: CheckOptions | undefined = requestHeaders
    ? { headers: requestHeaders }
    : undefined;

  async function openUpdate() {
    return withTimeout(pluginCheck(checkOptions), timeoutMs);
  }

  return {
    async check() {
      let update: Awaited<ReturnType<typeof pluginCheck>> = null;
      try {
        update = await openUpdate();
        if (!update) return null;
        if (typeof update.version !== 'string' || update.version.length === 0) {
          throw new UpdateSourceError('malformed', 'update manifest has no version');
        }
        return {
          version: update.version,
          currentVersion: update.currentVersion,
          notes: update.body ?? null,
          publishedAt: update.date ?? null,
        } satisfies UpdateCandidate;
      } catch (error) {
        throw asSourceError(error, 'network');
      } finally {
        await update?.close();
      }
    },

    async downloadAndInstall(candidate, onProgress) {
      let update: Awaited<ReturnType<typeof pluginCheck>> = null;
      try {
        update = await openUpdate();
        if (!update || update.version !== candidate.version) {
          throw new UpdateSourceError(
            'unavailable',
            `version ${candidate.version} is no longer offered`,
          );
        }
        await update.downloadAndInstall((event) => {
          if (event.event === 'Started') {
            onProgress({ chunkLength: 0, contentLength: event.data.contentLength ?? null });
          } else if (event.event === 'Progress') {
            onProgress({ chunkLength: event.data.chunkLength, contentLength: null });
          }
        });
      } catch (error) {
        throw asSourceError(error, 'install');
      } finally {
        await update?.close();
      }
    },

    async relaunch() {
      await relaunch();
    },
  } satisfies UpdateSource;
}
