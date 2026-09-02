/**
 * Vendored auto-updater module — see docs/adr/0001-vendor-updater-module-per-app.md.
 *
 * Everything an app can differ on lives behind `UpdateSource`. The policy core
 * (controller, scheduler, dialog) is meant to stay byte-identical across the
 * apps that copy this directory.
 */

/** Why a check was started. `manual` always resolves to a visible answer. */
export type CheckReason = 'startup' | 'periodic' | 'focus' | 'manual';

/** Stable, translatable error codes. Never surface a raw plugin string to the UI. */
export type UpdateErrorCode =
  | 'network'
  | 'timeout'
  | 'signature'
  | 'malformed'
  | 'unavailable'
  | 'install'
  | 'unknown';

export interface UpdateError {
  code: UpdateErrorCode;
  /** Developer-facing detail. The dialog translates `code`, it does not print this. */
  message: string;
}

/** An update the source is willing to install, with the plugin handle already released. */
export interface UpdateCandidate {
  version: string;
  currentVersion: string;
  notes: string | null;
  publishedAt: string | null;
}

/** One download event from the source. The controller accumulates these. */
export interface DownloadChunk {
  chunkLength: number;
  /** Total download size when the server announced one, else null. */
  contentLength: number | null;
}

/** Accumulated download position. `totalBytes` null means indeterminate. */
export interface DownloadProgress {
  downloadedBytes: number;
  totalBytes: number | null;
}

export type UpdateState =
  | { status: 'idle' }
  | { status: 'checking'; reason: CheckReason }
  | { status: 'upToDate'; checkedAt: number }
  | { status: 'available'; candidate: UpdateCandidate; reason: CheckReason }
  | { status: 'downloading'; candidate: UpdateCandidate; progress: DownloadProgress }
  | { status: 'readyToRestart'; candidate: UpdateCandidate }
  | { status: 'failed'; error: UpdateError; reason: CheckReason };

export type UpdateStatus = UpdateState['status'];

/**
 * The one seam between apps: where updates come from and how they install.
 * Skilltopia supplies a public-GitHub source; a paid app supplies an entitled one.
 */
export interface UpdateSource {
  check(reason: CheckReason): Promise<UpdateCandidate | null>;
  downloadAndInstall(
    candidate: UpdateCandidate,
    onProgress: (chunk: DownloadChunk) => void,
  ): Promise<void>;
  /** Restart into the installed version. Separate so the controller stays Tauri-free. */
  relaunch(): Promise<void>;
}

/** Error carrying a stable code, thrown by sources and read by the controller. */
export class UpdateSourceError extends Error {
  readonly code: UpdateErrorCode;

  constructor(code: UpdateErrorCode, message: string) {
    super(message);
    this.name = 'UpdateSourceError';
    this.code = code;
  }
}

export function toUpdateError(error: unknown, fallback: UpdateErrorCode): UpdateError {
  if (error instanceof UpdateSourceError) {
    return { code: error.code, message: error.message };
  }
  return { code: fallback, message: error instanceof Error ? error.message : String(error) };
}
