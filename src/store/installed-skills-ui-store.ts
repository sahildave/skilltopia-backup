import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  ALL_AGENTS_FILTER_ID,
  type ProviderFilterId,
} from '@/components/skills-manager/installed-skills-model';

export type LibraryLayoutMode = 'grid' | 'list';

interface InstalledSkillsUiState {
  /** Provider filter; defaults to All Agents; session-only (no persist). */
  providerFilter: ProviderFilterId;
  /** Off by default; reset when filter or Installed Skills tab changes. */
  showAllUniversal: boolean;
  /** Grid/list layout for installed skill items; session-only. */
  layoutMode: LibraryLayoutMode;
  setProviderFilter: (id: ProviderFilterId) => void;
  setShowAllUniversal: (value: boolean) => void;
  setLayoutMode: (mode: LibraryLayoutMode) => void;
  /** Call when leaving Installed Skills or when filter changes from UI. */
  resetShowAllUniversal: () => void;
}

export const useInstalledSkillsUiStore = create<InstalledSkillsUiState>()(
  devtools(
    (set) => ({
      providerFilter: ALL_AGENTS_FILTER_ID,
      showAllUniversal: false,
      layoutMode: 'grid',

      setProviderFilter: (id) =>
        set({ providerFilter: id, showAllUniversal: false }, undefined, 'setProviderFilter'),

      setShowAllUniversal: (value) =>
        set({ showAllUniversal: value }, undefined, 'setShowAllUniversal'),

      setLayoutMode: (mode) => set({ layoutMode: mode }, undefined, 'setLayoutMode'),

      resetShowAllUniversal: () =>
        set({ showAllUniversal: false }, undefined, 'resetShowAllUniversal'),
    }),
    { name: 'installed-skills-ui-store' },
  ),
);
