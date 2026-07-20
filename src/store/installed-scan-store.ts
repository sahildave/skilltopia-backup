import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { platform } from '@platform';
import type { InstalledScanSnapshot } from '@/platform/types';

interface InstalledScanState {
  snapshot: InstalledScanSnapshot | null;
  error: string | null;
  refreshing: boolean;
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
