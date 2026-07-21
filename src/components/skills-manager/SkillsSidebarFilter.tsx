import { Separator } from '@/components/ui/separator';
import type { ReactNode } from 'react';

export function SkillsSidebarFilter({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <Separator className="my-3" />
      <div className="ms-4 min-h-0 flex-1 overflow-y-auto border-s-2 border-border ps-2 pe-2 pb-2">
        <div className="px-1 py-1">
          <p className="text-muted-foreground text-xs font-medium uppercase">{title}</p>
        </div>
        {children}
      </div>
    </>
  );
}
