import { describe, expect, it, vi } from 'vitest';
import { createUpdateController, REOFFER_AFTER_MS } from '../controller';
import { UpdateSourceError, type UpdateState } from '../types';
import { CANDIDATE, createFakeSource } from './fake-source';

/**
 * Everything here is asserted through the observed `UpdateState` sequence and
 * calls made on the fake source. No test reaches into controller internals.
 */
function setup(startAt = 1_000) {
  const fake = createFakeSource();
  let clock = startAt;
  const controller = createUpdateController({
    source: fake.source,
    now: () => clock,
  });
  const seen: UpdateState[] = [];
  controller.subscribe((state) => seen.push(state));
  return {
    fake,
    controller,
    seen,
    statuses: () => seen.map((state) => state.status),
    advance(ms: number) {
      clock += ms;
    },
  };
}

describe('update controller — transition table', () => {
  it('idle → checking → upToDate when the source has nothing', async () => {
    const { fake, controller, statuses } = setup();
    expect(controller.getState()).toEqual({ status: 'idle' });

    const done = controller.check('startup');
    expect(controller.getState()).toEqual({ status: 'checking', reason: 'startup' });

    fake.resolveCheck(null);
    expect(await done).toEqual({ status: 'upToDate', checkedAt: 1_000 });
    expect(statuses()).toEqual(['checking', 'upToDate']);
    expect(controller.lastSuccessAt()).toBe(1_000);
  });

  it('idle → checking → available when the source offers a version', async () => {
    const { fake, controller, statuses } = setup();

    const done = controller.check('periodic');
    fake.resolveCheck(CANDIDATE);

    expect(await done).toEqual({ status: 'available', candidate: CANDIDATE, reason: 'periodic' });
    expect(statuses()).toEqual(['checking', 'available']);
  });

  it('available → downloading → readyToRestart → relaunch', async () => {
    const { fake, controller, statuses } = setup();

    const checked = controller.check('manual');
    fake.resolveCheck(CANDIDATE);
    await checked;

    const installed = controller.install();
    expect(controller.getState()).toEqual({
      status: 'downloading',
      candidate: CANDIDATE,
      progress: { downloadedBytes: 0, totalBytes: null },
    });

    fake.finishInstall();
    await installed;
    expect(controller.getState()).toEqual({ status: 'readyToRestart', candidate: CANDIDATE });

    await controller.restart();
    expect(fake.relaunch).toHaveBeenCalledOnce();
    expect(statuses()).toEqual(['checking', 'available', 'downloading', 'readyToRestart']);
  });

  it('checking → failed carries a stable error code, and never marks a success', async () => {
    const { fake, controller } = setup();

    const done = controller.check('startup');
    fake.rejectCheck(new UpdateSourceError('signature', 'bad signature'));

    expect(await done).toEqual({
      status: 'failed',
      error: { code: 'signature', message: 'bad signature' },
      reason: 'startup',
    });
    expect(controller.lastSuccessAt()).toBeNull();
  });

  it('downloading → failed when the install throws', async () => {
    const { fake, controller, statuses } = setup();

    const checked = controller.check('manual');
    fake.resolveCheck(CANDIDATE);
    await checked;

    const installed = controller.install();
    fake.failInstall(new Error('disk full'));
    await installed;

    expect(controller.getState()).toEqual({
      status: 'failed',
      error: { code: 'install', message: 'disk full' },
      reason: 'manual',
    });
    expect(statuses()).toEqual(['checking', 'available', 'downloading', 'failed']);
  });

  it('does not restart unless the install finished', async () => {
    const { fake, controller } = setup();

    await controller.restart();
    expect(fake.relaunch).not.toHaveBeenCalled();
  });
});

describe('update controller — download progress', () => {
  it('accumulates bytes across chunks and keeps the announced total', async () => {
    const { fake, controller } = setup();

    const checked = controller.check('manual');
    fake.resolveCheck(CANDIDATE);
    await checked;

    const installed = controller.install();
    fake.emit({ chunkLength: 0, contentLength: 1_000 });
    fake.emit({ chunkLength: 400, contentLength: null });
    fake.emit({ chunkLength: 350, contentLength: null });

    expect(controller.getState()).toEqual({
      status: 'downloading',
      candidate: CANDIDATE,
      progress: { downloadedBytes: 750, totalBytes: 1_000 },
    });

    fake.finishInstall();
    await installed;
  });

  it('stays indeterminate when the source never announces a size', async () => {
    const { fake, controller } = setup();

    const checked = controller.check('manual');
    fake.resolveCheck(CANDIDATE);
    await checked;

    const installed = controller.install();
    fake.emit({ chunkLength: 120, contentLength: null });

    expect(controller.getState()).toMatchObject({
      progress: { downloadedBytes: 120, totalBytes: null },
    });

    fake.finishInstall();
    await installed;
  });
});

describe('update controller — serialization', () => {
  it('returns the in-flight promise to a concurrent check', async () => {
    const { fake, controller } = setup();

    const first = controller.check('startup');
    const second = controller.check('periodic');
    expect(second).toBe(first);
    expect(fake.checkCalls).toEqual(['startup']);

    fake.resolveCheck(null);
    await first;
  });

  it('ignores a second install click while the first is downloading', async () => {
    const { fake, controller } = setup();

    const checked = controller.check('manual');
    fake.resolveCheck(CANDIDATE);
    await checked;

    const first = controller.install();
    const second = controller.install();
    await second;

    expect(fake.downloadAndInstall).toHaveBeenCalledOnce();
    expect(controller.getState().status).toBe('downloading');

    fake.finishInstall();
    await first;
  });

  it('leaves a download alone when a scheduled check fires', async () => {
    const { fake, controller } = setup();

    const checked = controller.check('manual');
    fake.resolveCheck(CANDIDATE);
    await checked;

    const installed = controller.install();
    const duringDownload = await controller.check('periodic');

    expect(duringDownload.status).toBe('downloading');
    expect(fake.checkCalls).toEqual(['manual']);

    fake.finishInstall();
    await installed;
  });
});

describe('update controller — dismissal', () => {
  async function offerAndDismiss(harness: ReturnType<typeof setup>) {
    const checked = harness.controller.check('startup');
    harness.fake.resolveCheck(CANDIDATE);
    await checked;
    harness.controller.dismiss();
    expect(harness.controller.getState()).toEqual({ status: 'idle' });
  }

  it('suppresses a re-prompt for the dismissed version', async () => {
    const harness = setup();
    await offerAndDismiss(harness);

    const again = harness.controller.check('periodic');
    harness.fake.resolveCheck(CANDIDATE);

    expect(await again).toEqual({ status: 'idle' });
  });

  it('still offers a different version after a dismissal', async () => {
    const harness = setup();
    await offerAndDismiss(harness);

    const newer = { ...CANDIDATE, version: '1.3.0' };
    const again = harness.controller.check('periodic');
    harness.fake.resolveCheck(newer);

    expect(await again).toEqual({ status: 'available', candidate: newer, reason: 'periodic' });
  });

  it('re-offers the same version once the dismissal is 24h old', async () => {
    const harness = setup();
    await offerAndDismiss(harness);
    harness.advance(REOFFER_AFTER_MS);

    const again = harness.controller.check('periodic');
    harness.fake.resolveCheck(CANDIDATE);

    expect((await again).status).toBe('available');
  });

  it('re-offers a dismissed version immediately on a manual check', async () => {
    const harness = setup();
    await offerAndDismiss(harness);

    const again = harness.controller.check('manual');
    harness.fake.resolveCheck(CANDIDATE);

    expect(await again).toEqual({ status: 'available', candidate: CANDIDATE, reason: 'manual' });
  });
});

describe('update controller — a manual check always answers', () => {
  it('lands on the in-flight startup check and still shows the dismissed version', async () => {
    const harness = setup();
    const { controller, fake } = harness;

    const first = controller.check('startup');
    fake.resolveCheck(CANDIDATE);
    await first;
    controller.dismiss();

    // Startup check runs again on a later launch; the user asks mid-flight.
    const startup = controller.check('startup');
    const manual = controller.check('manual');
    expect(manual).toBe(startup);

    fake.resolveCheck(CANDIDATE);
    const state = await manual;

    expect(state).toEqual({ status: 'available', candidate: CANDIDATE, reason: 'manual' });
    expect(fake.checkCalls).toEqual(['startup', 'startup']);
  });

  it('reports failure rather than silence when the source is unreachable', async () => {
    const { fake, controller } = setup();

    const done = controller.check('manual');
    fake.rejectCheck(new Error('boom'));
    const state = await done;

    expect(state.status).toBe('failed');
    expect(state).toMatchObject({ error: { code: 'network' }, reason: 'manual' });
  });

  it('runs a fresh check once the previous one has settled', async () => {
    const { fake, controller } = setup();

    const first = controller.check('startup');
    fake.resolveCheck(null);
    await first;

    const second = controller.check('manual');
    expect(second).not.toBe(first);
    fake.resolveCheck(null);
    await second;

    expect(fake.checkCalls).toEqual(['startup', 'manual']);
  });
});

describe('update controller — subscribers', () => {
  it('stops notifying after unsubscribe', async () => {
    const { fake, controller } = setup();
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    unsubscribe();

    const done = controller.check('startup');
    fake.resolveCheck(null);
    await done;

    expect(listener).not.toHaveBeenCalled();
  });
});
