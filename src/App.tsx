import { useEffect } from 'react';
import { initializeCommandSystem } from './lib/commands';
import { buildAppMenu, setupMenuLanguageListener } from './lib/menu';
import { initializeLanguage } from './i18n/language-init';
import { logger } from './lib/logger';
import { cleanupOldFiles } from './lib/recovery';
import { commands } from './lib/tauri-bindings';
import './App.css';
import { MainWindow } from './components/layout/MainWindow';
import { ThemeProvider } from './components/ThemeProvider';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useSquareCornersEffect } from './hooks/useSquareCornersEffect';
import {
  connectUpdateStore,
  createPublicGitHubUpdateSource,
  createUpdateController,
  startUpdateScheduler,
  UpdateDialog,
  useUpdateStore,
} from './platform/updates';

/**
 * The shell's view of the update module: state comes from the store, every
 * action goes back to the controller. No Tauri call and no timer lives here.
 */
function AppUpdateDialog() {
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

function App() {
  useSquareCornersEffect();

  // Initialize command system and cleanup on app startup
  useEffect(() => {
    logger.info('🚀 Frontend application starting up');
    initializeCommandSystem();
    logger.debug('Command system initialized');

    // Initialize language based on saved preference or system locale
    const initLanguageAndMenu = async () => {
      try {
        // Load preferences to get saved language
        const result = await commands.loadPreferences();
        const savedLanguage = result.status === 'ok' ? result.data.language : null;

        // Initialize language (will use system locale if no preference)
        await initializeLanguage(savedLanguage);

        // Build the application menu with the initialized language
        await buildAppMenu();
        logger.debug('Application menu built');
        setupMenuLanguageListener();
      } catch (error) {
        logger.warn('Failed to initialize language or menu', { error });
      }
    };

    initLanguageAndMenu();

    // Clean up old recovery files on startup
    cleanupOldFiles().catch((error) => {
      logger.warn('Failed to cleanup old recovery files', { error });
    });

    // Example of logging with context
    logger.info('App environment', {
      isDev: import.meta.env.DEV,
      mode: import.meta.env.MODE,
    });
  }, []);

  // Updates: the controller owns the policy, the scheduler owns every timer.
  // Nothing here blocks startup, and an automatic check that fails stays quiet —
  // it only lights the indicator in General preferences.
  useEffect(() => {
    const controller = createUpdateController({ source: createPublicGitHubUpdateSource() });
    const disconnect = connectUpdateStore(controller);
    const stopScheduler = startUpdateScheduler({ controller });

    return () => {
      stopScheduler();
      disconnect();
    };
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <MainWindow />
        <AppUpdateDialog />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
