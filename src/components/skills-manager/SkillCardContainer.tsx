import { getSeedForView } from '@/data/skills-seed';
import { cn } from '@/lib/utils';
import type { InstalledScanSnapshot, ScannedSkill } from '@/platform/types';
import { collectCachedLeaderboardSkillsFromClient } from '@/services/local-skills-search';
import type { LibraryLayoutMode } from '@/store/installed-skills-ui-store';
import { useQueryClient } from '@tanstack/react-query';
import {
  catalogSkillsByInstalledKey,
  findCatalogSkillForInstalled,
} from './catalog-installed-match';
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
  const queryClient = useQueryClient();
  // Cached catalog rows let an installed skill open the same detail the Explore
  // card shows; unmatched skills fall back to a local-only detail body.
  const catalogByKey = catalogSkillsByInstalledKey(
    collectCachedLeaderboardSkillsFromClient(queryClient, getSeedForView('all-time')),
  );

  return (
    <div
      data-testid="skill-card-container"
      data-layout={layoutMode}
      className={cn(layoutMode === 'grid' ? 'grid grid-cols-3 gap-4' : 'flex flex-col gap-3')}
    >
      {skills.map((skill) =>
        layoutMode === 'grid' ? (
          <SkillCard
            key={skill.name}
            skill={skill}
            snapshot={snapshot}
            providerFilter={providerFilter}
            catalogSkill={findCatalogSkillForInstalled(skill, catalogByKey)}
          />
        ) : (
          <SkillListRow
            key={skill.name}
            skill={skill}
            snapshot={snapshot}
            providerFilter={providerFilter}
            catalogSkill={findCatalogSkillForInstalled(skill, catalogByKey)}
          />
        ),
      )}
    </div>
  );
}
