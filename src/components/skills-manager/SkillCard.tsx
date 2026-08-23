import type { SkillsShSkill } from '@/catalog/types';
import { MorphingDialogTitle } from '@/components/ui/morphing-dialog';
import type { InstalledScanSnapshot, ScannedSkill } from '@/platform/types';
import { CatalogInstalledMenu } from './CatalogSkillActions';
import type { ProviderFilterId } from './installed-skills-model';
import { InstalledSkillDialog } from './InstalledSkillDialog';
import { SkillProviderBadges } from './SkillProviderBadges';
import { SkillSurfaceCard } from './SkillSurfaceCard';

export function SkillCard({
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
      <SkillSurfaceCard
        title={<MorphingDialogTitle>{skill.name}</MorphingDialogTitle>}
        subtitle={
          <div className="text-muted-foreground line-clamp-2 text-sm text-pretty">
            {skill.description}
          </div>
        }
        footerLeading={<SkillProviderBadges skill={skill} snapshot={snapshot} />}
        footerTrailing={
          <CatalogInstalledMenu
            snapshot={snapshot}
            scannedSkill={skill}
            providerFilter={providerFilter}
          />
        }
      />
    </InstalledSkillDialog>
  );
}
