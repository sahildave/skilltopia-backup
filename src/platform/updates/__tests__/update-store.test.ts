import { beforeEach, describe, expect, it } from 'vitest';
import { createUpdateController } from '../controller';
import { connectUpdateStore, requestManualUpdateCheck, useUpdateStore } from '../update-store';
import { CANDIDATE, createFakeSource } from './fake-source';

describe('update store', () => {
  beforeEach(() => {
    useUpdateStore.setState({ state: { status: 'idle' }, dialogOpen: false, controller: null });
  });

  it('mirrors controller state and opens the dialog when there is an offer', async () => {
    const fake = createFakeSource();
    const controller = createUpdateController({ source: fake.source });
    const disconnect = connectUpdateStore(controller);

    const checked = controller.check('startup');
    expect(useUpdateStore.getState().state).toEqual({ status: 'checking', reason: 'startup' });
    expect(useUpdateStore.getState().dialogOpen).toBe(false);

    fake.resolveCheck(CANDIDATE);
    await checked;
    expect(useUpdateStore.getState().dialogOpen).toBe(true);

    disconnect();
  });

  it('leaves the dialog closed for a silent up-to-date check', async () => {
    const fake = createFakeSource();
    const controller = createUpdateController({ source: fake.source });
    const disconnect = connectUpdateStore(controller);

    const checked = controller.check('periodic');
    fake.resolveCheck(null);
    await checked;

    expect(useUpdateStore.getState().state.status).toBe('upToDate');
    expect(useUpdateStore.getState().dialogOpen).toBe(false);

    disconnect();
  });

  it('opens the dialog and checks when the user asks from the menu', async () => {
    const fake = createFakeSource();
    const controller = createUpdateController({ source: fake.source });
    const disconnect = connectUpdateStore(controller);

    const pending = requestManualUpdateCheck();
    expect(useUpdateStore.getState().dialogOpen).toBe(true);
    fake.resolveCheck(null);
    await pending;

    expect(fake.checkCalls).toEqual(['manual']);
    disconnect();
  });

  it('stops mirroring after disconnect', async () => {
    const fake = createFakeSource();
    const controller = createUpdateController({ source: fake.source });
    connectUpdateStore(controller)();

    const checked = controller.check('startup');
    fake.resolveCheck(null);
    await checked;

    expect(useUpdateStore.getState().state).toEqual({ status: 'idle' });
    expect(useUpdateStore.getState().controller).toBeNull();
  });
});
