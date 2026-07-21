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
  /** Grid/list layout for installed skill items; session-only. */
  layoutMode: LibraryLayoutMode;
  setProviderFilter: (id: ProviderFilterId) => void;
  setLayoutMode: (mode: LibraryLayoutMode) => void;
}

export const useInstalledSkillsUiStore = create<InstalledSkillsUiState>()(
  devtools(
    (set) => ({
      providerFilter: ALL_AGENTS_FILTER_ID,
      layoutMode: 'grid',

      setProviderFilter: (id) => set({ providerFilter: id }, undefined, 'setProviderFilter'),

      setLayoutMode: (mode) => set({ layoutMode: mode }, undefined, 'setLayoutMode'),
    }),
    { name: 'installed-skills-ui-store' },
  ),
);
