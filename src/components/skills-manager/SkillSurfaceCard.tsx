import { Card, CardFooter, CardHeader } from '@/components/ui/card';
import type { ReactNode } from 'react';

const SURFACE_CARD_CLASS =
  'group/card relative gap-4 overflow-visible has-[[role=menu]]:z-20 ring-1 ring-foreground/5 dark:ring-foreground/10 hover:scale-102 hover:bg-linear-to-t hover:from-secondary hover:via-background hover:to-background dark:hover:bg-linear-to-t dark:hover:from-primary/10 dark:hover:via-secondary/30 dark:hover:to-transparent transition-all';

export function SkillSurfaceCard({
  title,
  subtitle,
  headerTrailing,
  footerLeading,
  footerTrailing,
}: {
  title: ReactNode;
  subtitle: ReactNode;
  headerTrailing?: ReactNode;
  footerLeading?: ReactNode;
  footerTrailing?: ReactNode;
}) {
  return (
    <Card className={SURFACE_CARD_CLASS}>
      <CardHeader className="px-4 gap-1.5">
        <div className="relative flex items-start justify-between gap-2 text-base">
          {title}
          {headerTrailing ? (
            <div className="absolute top-0 right-1 shrink-0">{headerTrailing}</div>
          ) : null}
        </div>
        {subtitle}
      </CardHeader>
      <CardFooter className="flex-wrap justify-between gap-1 px-4 pt-0">
        {footerLeading}
        {footerTrailing}
      </CardFooter>
    </Card>
  );
}
