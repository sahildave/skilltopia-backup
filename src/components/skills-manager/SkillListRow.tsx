import { Badge } from '@/components/ui/badge';
import type { InstalledScanSnapshot, ScannedSkill } from '@/platform/types';
import { useReducedMotion } from 'motion/react';
import { providerTagsForSkill, type ProviderFilterId } from './installed-skills-model';
import { SkillCardOverflowMenu } from './SkillCardOverflowMenu';

export function SkillListRow({
  skill,
  snapshot,
  providerFilter,
}: {
  skill: ScannedSkill;
  snapshot: InstalledScanSnapshot;
  providerFilter: ProviderFilterId;
}) {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <div
      data-slot="skill-list-row"
      className="flex items-center gap-3 border-b border-border/60 py-3 last:border-b-0"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{skill.name}</p>
        <p className="text-muted-foreground line-clamp-1 text-xs text-pretty">
          {skill.description}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <div className="flex flex-wrap justify-end gap-1.5">
          {providerTagsForSkill(skill, snapshot).map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
        <span className="text-muted-foreground text-xs">{skill.scope}</span>
        <SkillCardOverflowMenu
          skill={skill}
          providerFilter={providerFilter}
          reduceMotion={reduceMotion}
        />
      </div>
    </div>
  );
}
