import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function BadgeWithHelp({ tooltip }: { tooltip: string }) {
  return (
    <Badge variant="secondary" className="size-3 px-1 text-muted-foreground">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex size-4 items-center justify-center rounded-lg leading-none"
            aria-label={tooltip}
          >
            ?
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-56 whitespace-pre-line normal-case">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </Badge>
  );
}
