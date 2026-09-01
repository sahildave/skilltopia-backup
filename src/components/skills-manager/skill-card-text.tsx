import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

/** Skill name as shown on a card/row surface. */
export function SkillCardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn('truncate text-balance line-clamp-1 font-semibold leading-normal', className)}
    >
      {children}
    </div>
  );
}

/** Secondary line (source, provider) under a card/row title. */
export function SkillCardSubtitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('text-muted-foreground truncate text-sm text-pretty', className)}>
      {children}
    </div>
  );
}
