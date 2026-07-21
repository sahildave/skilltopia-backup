import { Card } from '@/components/ui/card';
import type { ReactNode } from 'react';

export function SkillSurfaceListRow({
  title,
  subtitle,
  trailing,
}: {
  title: ReactNode;
  subtitle: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <Card className="flex flex-row items-center has-[[role=menu]]:z-20 ring-1 ring-foreground/5 dark:ring-foreground/10 rounded-[min(var(--radius-4xl),24px)] gap-3 py-(--card-spacing) [--card-spacing:--spacing(5)] px-4 hover:scale-101 transition-all hover:bg-linear-to-t hover:from-secondary hover:via-background hover:to-background dark:hover:bg-linear-to-t dark:hover:from-primary/10 dark:hover:via-secondary/30 dark:hover:to-transparent justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 max-w-prose">
        {title}
        {subtitle}
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-2">{trailing}</div> : null}
    </Card>
  );
}
