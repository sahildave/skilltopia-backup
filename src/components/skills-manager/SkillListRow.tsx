import type { InstalledScanSnapshot, ScannedSkill } from '@/platform/types';
import { useReducedMotion } from 'motion/react';
import type { ProviderFilterId } from './installed-skills-model';
import { SkillCardOverflowMenu } from './SkillCardOverflowMenu';
import { SkillProviderBadges } from './SkillProviderBadges';
import { SkillSurfaceListRow } from './SkillSurfaceListRow';

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
    <div data-slot="skill-list-row">
      <SkillSurfaceListRow
        title={
          <div className="truncate text-balance h-6.5 line-clamp-1 font-semibold leading-normal">
            {skill.name}
          </div>
        }
        subtitle={
          <div className="text-muted-foreground truncate text-sm text-pretty max-w-prose line-clamp-1">
            {skill.description}
          </div>
        }
        trailing={
          <>
            <SkillProviderBadges skill={skill} snapshot={snapshot} />
            <SkillCardOverflowMenu
              skill={skill}
              snapshot={snapshot}
              providerFilter={providerFilter}
              reduceMotion={reduceMotion}
            />
          </>
        }
      />
    </div>
  );
}
