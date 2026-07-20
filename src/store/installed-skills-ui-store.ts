import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  ALL_AGENTS_FILTER_ID,
  type ProviderFilterId,
} from '@/components/skills-manager/installed-skills-model'

interface InstalledSkillsUiState {
  /** Provider filter; defaults to All Agents; session-only (no persist). */
  providerFilter: ProviderFilterId
  /** Off by default; reset when filter or Installed Skills tab changes. */
  showAllUniversal: boolean
  setProviderFilter: (id: ProviderFilterId) => void
  setShowAllUniversal: (value: boolean) => void
  /** Call when leaving Installed Skills or when filter changes from UI. */
  resetShowAllUniversal: () => void
}

export const useInstalledSkillsUiStore = create<InstalledSkillsUiState>()(
  devtools(
    set => ({
      providerFilter: ALL_AGENTS_FILTER_ID,
      showAllUniversal: false,

      setProviderFilter: id =>
        set(
          { providerFilter: id, showAllUniversal: false },
          undefined,
          'setProviderFilter'
        ),

      setShowAllUniversal: value =>
        set({ showAllUniversal: value }, undefined, 'setShowAllUniversal'),

      resetShowAllUniversal: () =>
        set({ showAllUniversal: false }, undefined, 'resetShowAllUniversal'),
    }),
    { name: 'installed-skills-ui-store' }
  )
)
