import { useEffect } from 'react'
import { platform } from '@platform'
import { useInstalledScanStore } from '@/store/installed-scan-store'
import { useInstalledSkillsUiStore } from '@/store/installed-skills-ui-store'
import type { SkillsNavId } from './types'

/** Rescan when Installed Skills is active; hydrate sidebar counts otherwise. */
export function useInstalledScanLifecycle(active: SkillsNavId) {
  const rescan = useInstalledScanStore(state => state.rescan)
  const hydrate = useInstalledScanStore(state => state.hydrate)
  const resetShowAllUniversal = useInstalledSkillsUiStore(
    state => state.resetShowAllUniversal
  )

  useEffect(() => {
    if (!platform.hasLocalLibrary) return
    if (active === 'library') {
      void rescan()
      return () => {
        resetShowAllUniversal()
      }
    }
    void hydrate()
  }, [active, rescan, hydrate, resetShowAllUniversal])
}
