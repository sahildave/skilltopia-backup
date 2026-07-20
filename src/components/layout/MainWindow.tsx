import { CommandPalette } from '@/components/command-palette/CommandPalette';
import { PreferencesDialog } from '@/components/preferences/PreferencesDialog';
import { SkillsContent, SkillsSidebar, type SkillsNavId } from '@/components/skills-manager';
import { TitleBar } from '@/components/titlebar/TitleBar';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useTheme } from '@/hooks/use-theme';
import { useMainWindowEventListeners } from '@/hooks/useMainWindowEventListeners';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/ui-store';
import { useState } from 'react';
import { Toaster } from 'sonner';
import { LeftSideBar } from './LeftSideBar';
import { MainWindowContent } from './MainWindowContent';
import { RightSideBar } from './RightSideBar';

/**
 * Layout sizing configuration for resizable panels.
 * All values are percentages of total width.
 * Sidebar defaults + main default must equal 100.
 */
const LAYOUT = {
  leftSidebar: { default: 16, min: 15, max: 18 },
  rightSidebar: { default: 20, min: 15, max: 40 },
  main: { min: 60 },
} as const;

export function MainWindow() {
  const { theme } = useTheme();
  const leftSidebarVisible = useUIStore((state) => state.leftSidebarVisible);
  const rightSidebarVisible = useUIStore((state) => state.rightSidebarVisible);
  const [activeNav, setActiveNav] = useState<SkillsNavId>('explore');

  const mainDefault = rightSidebarVisible
    ? 100 - LAYOUT.leftSidebar.default - LAYOUT.rightSidebar.default
    : 100 - LAYOUT.leftSidebar.default;

  // Set up global event listeners (keyboard shortcuts, etc.)
  useMainWindowEventListeners();

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden rounded-[var(--app-corner-radius)] bg-background">
      <TitleBar />

      <div className="flex flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel
            defaultSize={LAYOUT.leftSidebar.default}
            minSize={LAYOUT.leftSidebar.min}
            maxSize={LAYOUT.leftSidebar.max}
            className={cn(!leftSidebarVisible && 'hidden')}
          >
            <LeftSideBar>
              <SkillsSidebar active={activeNav} onSelect={setActiveNav} />
            </LeftSideBar>
          </ResizablePanel>

          <ResizableHandle className={cn(!leftSidebarVisible && 'hidden')} />

          <ResizablePanel defaultSize={mainDefault} minSize={LAYOUT.main.min}>
            <MainWindowContent>
              <SkillsContent active={activeNav} />
            </MainWindowContent>
          </ResizablePanel>

          <ResizableHandle className={cn(!rightSidebarVisible && 'hidden')} />

          <ResizablePanel
            defaultSize={LAYOUT.rightSidebar.default}
            minSize={LAYOUT.rightSidebar.min}
            maxSize={LAYOUT.rightSidebar.max}
            className={cn(!rightSidebarVisible && 'hidden')}
          >
            <RightSideBar />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Global UI Components (hidden until triggered) */}
      <CommandPalette />
      <PreferencesDialog />
      <Toaster
        position="top-right"
        theme={theme === 'dark' ? 'dark' : theme === 'light' ? 'light' : 'system'}
        className="toaster group"
        toastOptions={{
          classNames: {
            toast:
              'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
            description: 'group-[.toast]:text-muted-foreground',
            actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
            cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
          },
        }}
      />
    </div>
  );
}
