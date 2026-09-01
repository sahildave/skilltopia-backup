import type { SkillsShSkill } from '@/catalog/types';
import type { InstalledScanSnapshot, ScannedSkill } from '@/platform/types';
import { CatalogInstalledMenu } from './CatalogSkillActions';
import type { ProviderFilterId } from './installed-skills-model';
import { InstalledSkillDialog } from './InstalledSkillDialog';
import { SkillCardTitle } from './skill-card-text';
import { SkillProviderBadges } from './SkillProviderBadges';
import { SkillSurfaceListRow } from './SkillSurfaceListRow';

export function SkillListRow({
  skill,
  snapshot,
  providerFilter,
  catalogSkill,
}: {
  skill: ScannedSkill;
  snapshot: InstalledScanSnapshot;
  providerFilter: ProviderFilterId;
  catalogSkill?: SkillsShSkill;
}) {
  return (
    <InstalledSkillDialog
      skill={skill}
      snapshot={snapshot}
      providerFilter={providerFilter}
      catalogSkill={catalogSkill}
    >
      <div data-slot="skill-list-row">
        <SkillSurfaceListRow
          title={
            <div className="flex min-w-0 h-6.5 items-center gap-2">
              <SkillCardTitle className="min-w-0">{skill.name}</SkillCardTitle>
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
              <CatalogInstalledMenu
                snapshot={snapshot}
                scannedSkill={skill}
                providerFilter={providerFilter}
              />
            </>
          }
        />
      </div>
    </InstalledSkillDialog>
  );
}
