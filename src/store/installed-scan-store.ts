import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { platform } from '@platform';
import type { InstalledScanSnapshot } from '@/platform/types';

interface InstalledScanState {
  snapshot: InstalledScanSnapshot | null;
  error: string | null;
  refreshing: boolean;
  /**
   * Names of skills with an uninstall in flight. Shared, because one skill is
   * on screen in more than one place at once — its card and the detail dialog
   * opened from it — and the dialog closes mid-uninstall.
   */
  uninstalling: ReadonlySet<string>;
  beginUninstall: (skillName: string) => void;
  endUninstall: (skillName: string) => void;
  /**
   * Project-scoped installs from this session, keyed by the folder name the
   * skill was written as. The snapshot cannot carry them: it only covers the
   * home roots, and the project folder is picked per install.
   */
  projectInstalls: Record<string, string>;
  /** Remember that `installName` was installed into `projectPath`. */
  recordProjectInstall: (installName: string, projectPath: string) => void;
  /** Replace the platform cache and update React state. Keeps prior snapshot visible. */
  rescan: () => Promise<void>;
  /** Load cached snapshot once without forcing a filesystem rescan. */
  hydrate: () => Promise<void>;
}

let requestId = 0;

export const useInstalledScanStore = create<InstalledScanState>()(
  devtools(
    (set, get) => ({
      snapshot: null,
      error: null,
      refreshing: false,
      uninstalling: new Set<string>(),

      beginUninstall: (skillName) =>
        set(
          (state) => ({ uninstalling: new Set(state.uninstalling).add(skillName) }),
          undefined,
          'uninstall/start',
        ),

      endUninstall: (skillName) =>
        set(
          (state) => {
            const next = new Set(state.uninstalling);
            next.delete(skillName);
            return { uninstalling: next };
          },
          undefined,
          'uninstall/end',
        ),
      projectInstalls: {},

      recordProjectInstall: (installName, projectPath) => {
        set(
          (state) => ({
            projectInstalls: { ...state.projectInstalls, [installName]: projectPath },
          }),
          undefined,
          'recordProjectInstall',
        );
      },

      hydrate: async () => {
        if (!platform.hasLocalLibrary) return;
        if (get().snapshot !== null) return;
        const id = ++requestId;
        set({ refreshing: true, error: null }, undefined, 'hydrate/start');
        try {
          const snapshot = await platform.getInstalledScan();
          if (id !== requestId) return;
          set({ snapshot, refreshing: false }, undefined, 'hydrate/ok');
        } catch (err) {
          if (id !== requestId) return;
          set(
            {
              error: err instanceof Error ? err.message : String(err),
              refreshing: false,
            },
            undefined,
            'hydrate/error',
          );
        }
      },

      rescan: async () => {
        if (!platform.hasLocalLibrary) return;
        const id = ++requestId;
        set({ refreshing: true, error: null }, undefined, 'rescan/start');
        try {
          const snapshot = await platform.scanInstalled();
          if (id !== requestId) return;
          set({ snapshot, refreshing: false }, undefined, 'rescan/ok');
        } catch (err) {
          if (id !== requestId) return;
          set(
            {
              error: err instanceof Error ? err.message : String(err),
              refreshing: false,
            },
            undefined,
            'rescan/error',
          );
        }
      },
    }),
    { name: 'installed-scan-store' },
  ),
);
