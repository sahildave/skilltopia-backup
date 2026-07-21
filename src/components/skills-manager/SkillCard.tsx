import type { InstalledScanSnapshot, ScannedSkill } from '@/platform/types';
import { useReducedMotion } from 'motion/react';
import type { ProviderFilterId } from './installed-skills-model';
import { SkillCardOverflowMenu } from './SkillCardOverflowMenu';
import { SkillProviderBadges } from './SkillProviderBadges';
import { SkillSurfaceCard } from './SkillSurfaceCard';

export function SkillCard({
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
    <SkillSurfaceCard
      title={
        <div className="truncate text-balance line-clamp-1 font-semibold leading-normal">
          {skill.name}
        </div>
      }
      subtitle={
        <div className="text-muted-foreground line-clamp-2 text-sm text-pretty">
          {skill.description}
        </div>
      }
      footerLeading={<SkillProviderBadges skill={skill} snapshot={snapshot} />}
      footerTrailing={
        <SkillCardOverflowMenu
          skill={skill}
          snapshot={snapshot}
          providerFilter={providerFilter}
          reduceMotion={reduceMotion}
        />
      }
    />
  );
}
