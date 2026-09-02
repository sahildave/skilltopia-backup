import type { SkillsShSkill } from '@/catalog/types';
import { Button } from '@/components/ui/button';
import { DialogTitle } from '@/components/ui/dialog';
import type { InstalledScanSnapshot, ScannedSkill } from '@/platform/types';
import { platform } from '@platform';
import { FolderOpen } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { installedSkillKeysFromSkills } from './catalog-installed-match';
import { CatalogInstalledMenu } from './CatalogSkillActions';
import type { ProviderFilterId } from './installed-skills-model';
import { SkillDetailBody } from './SkillDetailDialog';
import { SkillDetailDialogShell } from './SkillDetailDialogShell';
import { SkillProviderBadges } from './SkillProviderBadges';

const DETAIL_SECTION_CLASS =
  'flex flex-col gap-2 rounded-[min(var(--radius-4xl),24px)] border bg-background px-4 py-4';

/** Detail body for a locally installed skill the catalog doesn't know about. */
function LocalSkillDetailBody({
  skill,
  snapshot,
  providerFilter,
}: {
  skill: ScannedSkill;
  snapshot: InstalledScanSnapshot;
  providerFilter: ProviderFilterId;
}) {
  const { t } = useTranslation();

  return (
    <div className="relative flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3 px-3 pt-2 pb-2 pe-8">
        <div className="flex min-w-0 flex-col gap-1.5">
          <DialogTitle className="text-lg leading-none text-balance">{skill.name}</DialogTitle>
          <div className="text-muted-foreground text-sm text-pretty">
            {t('skills.detail.localOnly')}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <SkillProviderBadges skill={skill} snapshot={snapshot} />
          <CatalogInstalledMenu
            snapshot={snapshot}
            scannedSkill={skill}
            providerFilter={providerFilter}
          />
        </div>
      </div>

      <section className={DETAIL_SECTION_CLASS}>
        <h3 className="text-lg leading-none text-balance">{t('skills.detail.description')}</h3>
        <p className="text-muted-foreground text-sm text-pretty">
          {skill.description || t('skills.detail.noDescription')}
        </p>
      </section>

      <section className={DETAIL_SECTION_CLASS}>
        <h3 className="text-lg leading-none text-balance">{t('skills.detail.locations')}</h3>
        {skill.paths.length === 0 ? (
          <p className="text-muted-foreground text-sm text-pretty">
            {t('skills.installed.pathUnknown')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {skill.paths.map((entry) => (
              <li key={entry.path} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground min-w-0 truncate font-mono text-xs">
                  {entry.originalPath ?? entry.path}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 rounded-full"
                  aria-label={t('skills.installed.revealPath')}
                  title={t('skills.installed.revealPath')}
                  onClick={() => void platform.revealPath(entry.originalPath ?? entry.path)}
                >
                  <FolderOpen data-icon="inline-start" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * Wraps an installed skill card / row in the same detail dialog the catalog
 * uses. Catalog-matched skills get the full catalog body; local-only skills get
 * a body built from the scan.
 */
export function InstalledSkillDialog({
  skill,
  snapshot,
  providerFilter,
  catalogSkill,
  children,
}: {
  skill: ScannedSkill;
  snapshot: InstalledScanSnapshot;
  providerFilter: ProviderFilterId;
  catalogSkill: SkillsShSkill | undefined;
  children: ReactNode;
}) {
  return (
    <SkillDetailDialogShell trigger={children}>
      {catalogSkill ? (
        <SkillDetailBody
          skill={catalogSkill}
          installedKeys={installedSkillKeysFromSkills([skill])}
          snapshot={snapshot}
          scannedSkill={skill}
          providerFilter={providerFilter}
        />
      ) : (
        <LocalSkillDetailBody skill={skill} snapshot={snapshot} providerFilter={providerFilter} />
      )}
    </SkillDetailDialogShell>
  );
}
