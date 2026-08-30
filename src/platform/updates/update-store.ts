import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { UpdateController } from './controller';
import type { UpdateState } from './types';

interface UpdateStoreState {
  /** Mirror of the controller state. The controller stays the owner. */
  state: UpdateState;
  dialogOpen: boolean;
  /** Set by `connectUpdateStore` so menu and palette entries can reach the policy. */
  controller: UpdateController | null;
  setDialogOpen: (open: boolean) => void;
}

export const useUpdateStore = create<UpdateStoreState>()(
  devtools(
    (set) => ({
      state: { status: 'idle' },
      dialogOpen: false,
      controller: null,
      setDialogOpen: (open) => set({ dialogOpen: open }, undefined, 'setDialogOpen'),
    }),
    { name: 'update-store' },
  ),
);

/**
 * Mirror a controller into the store and pop the dialog when there is something
 * to say. Returns the unsubscribe.
 */
export function connectUpdateStore(controller: UpdateController): () => void {
  useUpdateStore.setState(
    { controller, state: controller.getState() },
    undefined,
    'connectController',
  );

  const unsubscribe = controller.subscribe((state) => {
    const shouldOpen =
      state.status === 'available' ||
      state.status === 'downloading' ||
      state.status === 'readyToRestart';
    // A check the user did not ask for closes a dialog an earlier one left
    // open, so its answer — a failure above all — never lands on a stale panel.
    const startsQuietCheck = state.status === 'checking' && state.reason !== 'manual';
    useUpdateStore.setState(
      shouldOpen
        ? { state, dialogOpen: true }
        : startsQuietCheck
          ? { state, dialogOpen: false }
          : { state },
      undefined,
      `state/${state.status}`,
    );
  });

  return () => {
    unsubscribe();
    useUpdateStore.setState({ controller: null }, undefined, 'disconnectController');
  };
}

/**
 * The menu item and the palette command both mean the same thing: show the
 * dialog, then check, so the user gets an answer either way.
 */
export async function requestManualUpdateCheck(): Promise<void> {
  const { controller } = useUpdateStore.getState();
  if (!controller) return;
  useUpdateStore.setState({ dialogOpen: true }, undefined, 'manualCheck');
  await controller.check('manual');
}
