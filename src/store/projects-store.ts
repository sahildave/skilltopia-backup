import type { InstalledScanSnapshot, ProjectInfo } from '@/platform/types';
import { platform } from '@platform';
import { create } from 'zustand';

const ROOT_KEY = 'skilltopia.projects.root';
let requestId = 0;

function readRoot(): string | null {
  return typeof localStorage === 'undefined' ? null : localStorage.getItem(ROOT_KEY);
}

interface ProjectsState {
  root: string | null;
  projects: ProjectInfo[];
  selectedPath: string | null;
  snapshot: InstalledScanSnapshot | null;
  refreshing: boolean;
  error: string | null;
  chooseRoot: () => Promise<void>;
  clearSelection: () => void;
  refresh: () => Promise<void>;
  selectProject: (project: ProjectInfo) => Promise<void>;
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  root: readRoot(),
  projects: [],
  selectedPath: null,
  snapshot: null,
  refreshing: false,
  error: null,

  chooseRoot: async () => {
    const root = await platform.pickCodingFolder();
    if (!root) return;
    if (typeof localStorage !== 'undefined') localStorage.setItem(ROOT_KEY, root);
    set({ root, selectedPath: null, snapshot: null });
    await get().refresh();
  },

  clearSelection: () => {
    requestId += 1;
    set({ selectedPath: null, snapshot: null, error: null });
  },

  refresh: async () => {
    const root = get().root;
    if (!root) return;
    const currentRequest = ++requestId;
    set({ refreshing: true, error: null });
    try {
      const projects = await platform.listProjects(root);
      if (currentRequest !== requestId) return;
      const selectedPath = get().selectedPath;
      const selected =
        projects.find((project) => project.path === selectedPath) ?? projects[0] ?? null;
      set({ projects, selectedPath: selected?.path ?? null });
      if (selected) {
        const snapshot = await platform.scanProject(selected.path);
        if (currentRequest !== requestId) return;
        set({ snapshot });
      } else {
        set({ snapshot: null });
      }
    } catch (error) {
      if (currentRequest === requestId) {
        set({ error: error instanceof Error ? error.message : String(error) });
      }
    } finally {
      if (currentRequest === requestId) set({ refreshing: false });
    }
  },

  selectProject: async (project) => {
    const currentRequest = ++requestId;
    set({ selectedPath: project.path, refreshing: true, error: null });
    try {
      const snapshot = await platform.scanProject(project.path);
      if (currentRequest === requestId) set({ snapshot });
    } catch (error) {
      if (currentRequest === requestId) {
        set({ error: error instanceof Error ? error.message : String(error), snapshot: null });
      }
    } finally {
      if (currentRequest === requestId) set({ refreshing: false });
    }
  },
}));
