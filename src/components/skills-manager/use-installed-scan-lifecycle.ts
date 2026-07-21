import { useEffect } from 'react';
import { platform } from '@platform';
import { useInstalledScanStore } from '@/store/installed-scan-store';
import type { SkillsNavId } from './types';
import { useProjectsStore } from '@/store/projects-store';

/** Rescan when Installed Skills is active; hydrate sidebar counts otherwise. */
export function useInstalledScanLifecycle(active: SkillsNavId) {
  const rescan = useInstalledScanStore((state) => state.rescan);
  const hydrate = useInstalledScanStore((state) => state.hydrate);

  useEffect(() => {
    if (!platform.hasLocalLibrary) return;
    if (active === 'installed') {
      void rescan();
      return;
    }
    if (active === 'projects') {
      void useProjectsStore.getState().refresh();
    }
    void hydrate();
  }, [active, rescan, hydrate]);
}
