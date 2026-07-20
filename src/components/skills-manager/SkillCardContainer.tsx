import { cn } from '@/lib/utils';
import type { InstalledScanSnapshot, ScannedSkill } from '@/platform/types';
import type { LibraryLayoutMode } from '@/store/installed-skills-ui-store';
import type { ProviderFilterId } from './installed-skills-model';
import { SkillCard } from './SkillCard';
import { SkillListRow } from './SkillListRow';

export function SkillCardContainer({
  skills,
  snapshot,
  providerFilter,
  layoutMode,
}: {
  skills: ScannedSkill[];
  snapshot: InstalledScanSnapshot;
  providerFilter: ProviderFilterId;
  layoutMode: LibraryLayoutMode;
}) {
  return (
    <div
      data-testid="skill-card-container"
      data-layout={layoutMode}
      className={cn(layoutMode === 'grid' ? 'grid grid-cols-3 gap-4' : 'flex flex-col')}
    >
      {skills.map((skill) =>
        layoutMode === 'grid' ? (
          <SkillCard
            key={skill.name}
            skill={skill}
            snapshot={snapshot}
            providerFilter={providerFilter}
          />
        ) : (
          <SkillListRow
            key={skill.name}
            skill={skill}
            snapshot={snapshot}
            providerFilter={providerFilter}
          />
        ),
      )}
    </div>
  );
}
