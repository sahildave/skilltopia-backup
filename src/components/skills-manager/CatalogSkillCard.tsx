import type { SkillsShSkill } from '@/catalog/types';
import { Badge } from '@/components/ui/badge';
import type { InstalledScanSnapshot, ScannedSkill } from '@/platform/types';
import { isCatalogSkillInstalled } from './catalog-installed-match';
import {
  CatalogExternalInfoButton,
  CatalogInstalledMenu,
  SkillInstallMenu,
} from './CatalogSkillActions';
import { SkillCardSubtitle, SkillCardTitle } from './skill-card-text';
import { SkillDetailBody } from './SkillDetailDialog';
import { SkillDetailDialogShell } from './SkillDetailDialogShell';
import { SkillCategoryPills } from './SkillCategoryPills';
import { SkillProviderBadges } from './SkillProviderBadges';
import { SkillSurfaceCard } from './SkillSurfaceCard';
import { SkillSurfaceListRow } from './SkillSurfaceListRow';

function formatInstalls(count: number): string {
  return new Intl.NumberFormat(undefined, { notation: 'compact' }).format(count);
}

export function CatalogSkillCard({
  skill,
  installedKeys,
  snapshot,
  scannedSkill,
}: {
  skill: SkillsShSkill;
  installedKeys: Set<string>;
  snapshot: InstalledScanSnapshot | null;
  scannedSkill: ScannedSkill | undefined;
}) {
  const isInstalled = isCatalogSkillInstalled(skill, installedKeys);
  const manageable = isInstalled && snapshot !== null && scannedSkill !== undefined;

  return (
    <SkillDetailDialogShell
      trigger={
        <SkillSurfaceCard
          title={<SkillCardTitle>{skill.name}</SkillCardTitle>}
          subtitle={
            <div className="flex min-w-0 flex-col gap-1.5">
              <SkillCardSubtitle>{skill.source}</SkillCardSubtitle>
              <SkillCategoryPills categories={skill.categories ?? []} />
            </div>
          }
          headerTrailing={
            <Badge
              variant="secondary"
              size="sm"
              className="font-semibold text-muted-foreground font-mono"
            >
              {formatInstalls(skill.installs)}
            </Badge>
          }
          footerLeading={
            manageable ? (
              <SkillProviderBadges skill={scannedSkill} snapshot={snapshot} />
            ) : (
              <CatalogExternalInfoButton skill={skill} />
            )
          }
          footerTrailing={
            manageable ? (
              <CatalogInstalledMenu snapshot={snapshot} scannedSkill={scannedSkill} />
            ) : (
              <SkillInstallMenu skill={skill} installedKeys={installedKeys} />
            )
          }
        />
      }
    >
      <SkillDetailBody
        skill={skill}
        installedKeys={installedKeys}
        snapshot={snapshot}
        scannedSkill={scannedSkill}
      />
    </SkillDetailDialogShell>
  );
}

export function CatalogSkillListRow({
  skill,
  installedKeys,
  snapshot,
  scannedSkill,
}: {
  skill: SkillsShSkill;
  installedKeys: Set<string>;
  snapshot: InstalledScanSnapshot | null;
  scannedSkill: ScannedSkill | undefined;
}) {
  const manageable =
    isCatalogSkillInstalled(skill, installedKeys) &&
    snapshot !== null &&
    scannedSkill !== undefined;

  return (
    <SkillDetailDialogShell
      trigger={
        <div data-slot="catalog-skill-list-row">
          <SkillSurfaceListRow
            title={
              <div className="flex min-w-0 h-6.5 items-center gap-2">
                <SkillCardTitle className="min-w-0">{skill.name}</SkillCardTitle>
                <Badge
                  variant="secondary"
                  size="sm"
                  className="shrink-0 font-semibold text-muted-foreground font-mono"
                >
                  {formatInstalls(skill.installs)}
                </Badge>
              </div>
            }
            subtitle={
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <SkillCardSubtitle>{skill.source}</SkillCardSubtitle>
                <SkillCategoryPills categories={skill.categories ?? []} />
              </div>
            }
            trailing={
              <>
                <CatalogExternalInfoButton skill={skill} />
                {manageable ? (
                  <CatalogInstalledMenu snapshot={snapshot} scannedSkill={scannedSkill} />
                ) : (
                  <SkillInstallMenu skill={skill} installedKeys={installedKeys} />
                )}
              </>
            }
          />
        </div>
      }
    >
      <SkillDetailBody
        skill={skill}
        installedKeys={installedKeys}
        snapshot={snapshot}
        scannedSkill={scannedSkill}
      />
    </SkillDetailDialogShell>
  );
}
