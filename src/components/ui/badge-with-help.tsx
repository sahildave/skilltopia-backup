import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export function BadgeWithHelp({ tooltip, className }: { tooltip: string; className?: string }) {
  return (
    <Badge variant="secondary" className={cn('size-3 px-1 text-muted-foreground', className)}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            role="button"
            tabIndex={0}
            className="inline-flex size-4 items-center justify-center rounded-lg leading-none"
            aria-label={tooltip}
            onClick={(event) => event.stopPropagation()}
            onPointerDown={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            ?
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-56 whitespace-pre-line normal-case">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </Badge>
  );
}
