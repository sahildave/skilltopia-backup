import { LeftSideBar } from '@/components/layout/LeftSideBar';
import { SkillsContent, SkillsSidebar, type SkillsNavId } from '@/components/skills-manager';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/store/ui-store';
import { useState } from 'react';
import { Toaster } from 'sonner';

const LAYOUT = {
  leftSidebar: { default: 15, min: 13, max: 18 },
  main: { min: 30 },
} as const;

/**
 * Thin browser shell — skills UI without desktop chrome
 * (titlebar, native menu, prefs, updater, quick pane).
 */
export function WebShell() {
  const { theme } = useTheme();
  const leftSidebarVisible = useUIStore((state) => state.leftSidebarVisible);
  const [activeNav, setActiveNav] = useState<SkillsNavId>('explore');

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background">
      <div className="flex min-h-0 flex-1 overflow-hidden">
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

          <ResizablePanel defaultSize={100 - LAYOUT.leftSidebar.default} minSize={LAYOUT.main.min}>
            <div className="flex h-full min-w-0 flex-col overflow-hidden bg-background">
              <SkillsContent active={activeNav} />
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      <Toaster
        position="bottom-right"
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
