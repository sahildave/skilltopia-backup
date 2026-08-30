import { UpdateDialog } from './UpdateDialog';
import { useUpdateStore } from './update-store';

/**
 * The shell's view of the update module: state comes from the store, every
 * action goes back to the controller. No Tauri call and no timer lives here,
 * so it renders identically in the desktop shell and the mock browser target.
 */
export function StoreUpdateDialog() {
  const state = useUpdateStore((s) => s.state);
  const open = useUpdateStore((s) => s.dialogOpen);

  const dismiss = () => {
    const { controller, setDialogOpen } = useUpdateStore.getState();
    controller?.dismiss();
    setDialogOpen(false);
  };

  return (
    <UpdateDialog
      state={state}
      open={open}
      onInstall={() => void useUpdateStore.getState().controller?.install()}
      onDismiss={dismiss}
      onRestart={() => void useUpdateStore.getState().controller?.restart()}
      onRetry={() => void useUpdateStore.getState().controller?.check('manual')}
    />
  );
}
