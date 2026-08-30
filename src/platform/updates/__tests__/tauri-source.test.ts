import { relaunch } from '@tauri-apps/plugin-process';
import { check as pluginCheck, type DownloadEvent, type Update } from '@tauri-apps/plugin-updater';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createPublicGitHubUpdateSource } from '../public-github-source';
import { CHECK_TIMEOUT_MS, createTauriUpdateSource } from '../tauri-source';
import { UpdateSourceError, type DownloadChunk, type UpdateCandidate } from '../types';

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn().mockResolvedValue(undefined),
}));

const checkMock = vi.mocked(pluginCheck);
const relaunchMock = vi.mocked(relaunch);

const CANDIDATE: UpdateCandidate = {
  version: '1.2.0',
  currentVersion: '1.1.0',
  notes: 'Fixes things',
  publishedAt: '2026-08-30T00:00:00Z',
};

/** Stands in for the plugin's `Update` resource handle. */
function fakeUpdate(overrides: Partial<Update> = {}) {
  return {
    version: '1.2.0',
    currentVersion: '1.1.0',
    body: 'Fixes things',
    date: '2026-08-30T00:00:00Z',
    close: vi.fn().mockResolvedValue(undefined),
    downloadAndInstall: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as Update & {
    close: ReturnType<typeof vi.fn>;
    downloadAndInstall: ReturnType<typeof vi.fn>;
  };
}

describe('TauriUpdateSource', () => {
  beforeEach(() => {
    checkMock.mockReset();
    relaunchMock.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('maps an up-to-date answer to null', async () => {
    checkMock.mockResolvedValue(null);

    await expect(createTauriUpdateSource().check('startup')).resolves.toBeNull();
  });

  it('copies the candidate fields and closes the handle', async () => {
    const update = fakeUpdate();
    checkMock.mockResolvedValue(update);

    await expect(createTauriUpdateSource().check('manual')).resolves.toEqual(CANDIDATE);
    expect(update.close).toHaveBeenCalledOnce();
  });

  it('fills missing optional fields with null', async () => {
    const update = fakeUpdate({ body: undefined, date: undefined });
    checkMock.mockResolvedValue(update);

    await expect(createTauriUpdateSource().check('manual')).resolves.toMatchObject({
      notes: null,
      publishedAt: null,
    });
  });

  it('reports a malformed manifest and still closes the handle', async () => {
    const update = fakeUpdate({ version: '' });
    checkMock.mockResolvedValue(update);

    await expect(createTauriUpdateSource().check('manual')).rejects.toMatchObject({
      code: 'malformed',
    });
    expect(update.close).toHaveBeenCalledOnce();
  });

  it('classifies a network failure', async () => {
    checkMock.mockRejectedValue(new Error('Network Error: failed to connect'));

    await expect(createTauriUpdateSource().check('startup')).rejects.toMatchObject({
      code: 'network',
    });
  });

  it('gives up on a hung check after the timeout', async () => {
    vi.useFakeTimers();
    checkMock.mockReturnValue(new Promise<never>(() => undefined));

    const pending = createTauriUpdateSource().check('startup');
    const assertion = expect(pending).rejects.toBeInstanceOf(UpdateSourceError);
    await vi.advanceTimersByTimeAsync(CHECK_TIMEOUT_MS);
    await assertion;

    await expect(pending.catch((error: UpdateSourceError) => error.code)).resolves.toBe('timeout');
  });

  it('passes no request headers for a public feed', async () => {
    checkMock.mockResolvedValue(null);

    await createPublicGitHubUpdateSource().check('startup');

    expect(checkMock).toHaveBeenCalledOnce();
    expect(checkMock.mock.calls[0]).toEqual([undefined]);
  });

  it('sends headers only when an authenticated source asks for them', async () => {
    checkMock.mockResolvedValue(null);

    await createTauriUpdateSource({ requestHeaders: { Authorization: 'Bearer x' } }).check(
      'manual',
    );

    expect(checkMock.mock.calls[0]).toEqual([{ headers: { Authorization: 'Bearer x' } }]);
  });

  it('reopens a handle to install, forwards progress and closes it', async () => {
    const chunks: DownloadChunk[] = [];
    const update = fakeUpdate({
      downloadAndInstall: vi.fn(async (onEvent: (event: DownloadEvent) => void) => {
        onEvent({ event: 'Started', data: { contentLength: 900 } });
        onEvent({ event: 'Progress', data: { chunkLength: 500 } });
        onEvent({ event: 'Finished' });
      }),
    });
    checkMock.mockResolvedValue(update);

    await createTauriUpdateSource().downloadAndInstall(CANDIDATE, (chunk) => chunks.push(chunk));

    expect(chunks).toEqual([
      { chunkLength: 0, contentLength: 900 },
      { chunkLength: 500, contentLength: null },
    ]);
    expect(update.close).toHaveBeenCalledOnce();
  });

  it('reports a bad signature from the install', async () => {
    const update = fakeUpdate({
      downloadAndInstall: vi.fn().mockRejectedValue(new Error('Invalid signature')),
    });
    checkMock.mockResolvedValue(update);

    await expect(
      createTauriUpdateSource().downloadAndInstall(CANDIDATE, () => undefined),
    ).rejects.toMatchObject({ code: 'signature' });
    expect(update.close).toHaveBeenCalledOnce();
  });

  it('reports a version that vanished between the check and the click', async () => {
    checkMock.mockResolvedValue(fakeUpdate({ version: '1.4.0' }));

    await expect(
      createTauriUpdateSource().downloadAndInstall(CANDIDATE, () => undefined),
    ).rejects.toMatchObject({ code: 'unavailable' });
  });

  it('relaunches through plugin-process', async () => {
    await createTauriUpdateSource().relaunch();

    expect(relaunchMock).toHaveBeenCalledOnce();
  });
});
