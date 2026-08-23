import type { SkillsShSkill } from '@/catalog/types';
import { Badge } from '@/components/ui/badge';
import {
  MorphingDialog,
  MorphingDialogClose,
  MorphingDialogContainer,
  MorphingDialogContent,
  MorphingDialogSubtitle,
  MorphingDialogTitle,
  MorphingDialogTrigger,
} from '@/components/ui/morphing-dialog';
import type { InstalledScanSnapshot, ScannedSkill } from '@/platform/types';
import { isCatalogSkillInstalled } from './catalog-installed-match';
import {
  CatalogExternalInfoButton,
  CatalogInstalledMenu,
  SkillInstallMenu,
} from './CatalogSkillActions';
import { SkillDetailBody } from './SkillDetailDialog';
import { DETAIL_CONTENT_CLASS, MORPH_TRANSITION } from './skill-detail-chrome';
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
    <MorphingDialog transition={MORPH_TRANSITION}>
      <MorphingDialogTrigger asChild>
        <div>
          <SkillSurfaceCard
            title={<MorphingDialogTitle>{skill.name}</MorphingDialogTitle>}
            subtitle={<MorphingDialogSubtitle>{skill.source}</MorphingDialogSubtitle>}
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
        </div>
      </MorphingDialogTrigger>
      <MorphingDialogContainer>
        <MorphingDialogContent className={DETAIL_CONTENT_CLASS}>
          <SkillDetailBody
            skill={skill}
            installedKeys={installedKeys}
            snapshot={snapshot}
            scannedSkill={scannedSkill}
          />
          <MorphingDialogClose />
        </MorphingDialogContent>
      </MorphingDialogContainer>
    </MorphingDialog>
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
    <MorphingDialog transition={MORPH_TRANSITION}>
      <MorphingDialogTrigger asChild>
        <div data-slot="catalog-skill-list-row">
          <SkillSurfaceListRow
            title={
              <div className="flex min-w-0 h-6.5 items-center gap-2">
                <MorphingDialogTitle className="min-w-0 truncate">{skill.name}</MorphingDialogTitle>
                <Badge
                  variant="secondary"
                  size="sm"
                  className="shrink-0 font-semibold text-muted-foreground font-mono"
                >
                  {formatInstalls(skill.installs)}
                </Badge>
              </div>
            }
            subtitle={<MorphingDialogSubtitle>{skill.source}</MorphingDialogSubtitle>}
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
      </MorphingDialogTrigger>

      <MorphingDialogContainer>
        <MorphingDialogContent className={DETAIL_CONTENT_CLASS}>
          <SkillDetailBody
            skill={skill}
            installedKeys={installedKeys}
            snapshot={snapshot}
            scannedSkill={scannedSkill}
          />
          <MorphingDialogClose />
        </MorphingDialogContent>
      </MorphingDialogContainer>
    </MorphingDialog>
  );
}
