import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import {
  ALL_AGENTS_FILTER_ID,
  type ProviderFilterId,
} from '@/components/skills-manager/installed-skills-model';
import type { ProjectSkillScope } from '@/components/skills-manager/project-skills-model';

export type LibraryLayoutMode = 'grid' | 'list';

interface InstalledSkillsUiState {
  /** Provider filter; defaults to all installed skills; session-only (no persist). */
  providerFilter: ProviderFilterId;
  /** Grid/list layout for installed skill items; session-only. */
  layoutMode: LibraryLayoutMode;
  /** Which skills the Projects view lists for the selected project; session-only. */
  projectSkillScope: ProjectSkillScope;
  setProviderFilter: (id: ProviderFilterId) => void;
  setLayoutMode: (mode: LibraryLayoutMode) => void;
  setProjectSkillScope: (scope: ProjectSkillScope) => void;
}

export const useInstalledSkillsUiStore = create<InstalledSkillsUiState>()(
  devtools(
    (set) => ({
      providerFilter: ALL_AGENTS_FILTER_ID,
      layoutMode: 'grid',
      projectSkillScope: 'all',

      setProviderFilter: (id) => set({ providerFilter: id }, undefined, 'setProviderFilter'),

      setLayoutMode: (mode) => set({ layoutMode: mode }, undefined, 'setLayoutMode'),

      setProjectSkillScope: (scope) =>
        set({ projectSkillScope: scope }, undefined, 'setProjectSkillScope'),
    }),
    { name: 'installed-skills-ui-store' },
  ),
);
