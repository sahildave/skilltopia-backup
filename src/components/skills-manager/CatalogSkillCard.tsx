import type { SkillsShSkill } from '@/catalog/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useInstalledScanStore } from '@/store/installed-scan-store';
import { platform } from '@platform';
import { Check, ChevronDown, SquareArrowOutUpRight } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { isCatalogSkillInstalled } from './catalog-installed-match';
import {
  isInstallCancelled,
  isNodeRuntimeMissing,
  isPermissionError,
  isUnsupportedSkillSource,
} from './library-errors';
import { ALL_AGENTS_FILTER_ID } from './installed-skills-model';
import { SkillCardOverflowMenu } from './SkillCardOverflowMenu';
import { SkillDetailBody } from './SkillDetailDialog';
import { SkillProviderBadges } from './SkillProviderBadges';
import { SkillSurfaceCard } from './SkillSurfaceCard';
import { SkillSurfaceListRow } from './SkillSurfaceListRow';
import { SKILL_ACTION_PILL_CLASS } from './skill-chip';
import { summarizeTargetResults } from './target-results';
import type { InstallScope } from './types';

const MORPH_TRANSITION = { stiffness: 26.7, damping: 4.1, mass: 0.2 } as const;

function stopCardActivation(event: SyntheticEvent) {
  event.stopPropagation();
}

const DETAIL_CONTENT_CLASS =
  'app-material-strong bg-background relative max-h-[85vh] w-full max-w-[calc(100%-2rem)] overflow-y-auto rounded-[min(var(--radius-4xl),24px)] border p-6 scrollbar-none shadow-lg sm:max-w-2xl';

function formatInstalls(count: number): string {
  return new Intl.NumberFormat(undefined, { notation: 'compact' }).format(count);
}

export function SkillInstallMenu({
  skill,
  installedKeys,
}: {
  skill: SkillsShSkill;
  installedKeys: Set<string>;
}) {
  const { t } = useTranslation();
  const [installing, setInstalling] = useState(false);
  const copiesCommand = platform.copiesInstallCommand;
  const isInstalled = isCatalogSkillInstalled(skill, installedKeys);

  const handleInstall = async (scope: InstallScope) => {
    setInstalling(true);
    try {
      const outcome = summarizeTargetResults(
        await platform.install(
          {
            id: skill.id,
            name: skill.name,
            installUrl: skill.installUrl,
          },
          scope,
        ),
      );
      const issues = outcome.issues
        ? { description: t('skills.install.issuesDescription', { providers: outcome.issues }) }
        : undefined;

      if (outcome.unsettled === 0) {
        toast.success(
          t(copiesCommand ? 'skills.install.copied' : 'skills.install.success', {
            name: skill.name,
          }),
        );
      } else if (outcome.settled > 0) {
        toast.warning(
          t('skills.install.partial', {
            name: skill.name,
            settled: outcome.settled,
            failed: outcome.unsettled,
          }),
          issues,
        );
      } else {
        toast.error(t('skills.install.failed', { name: skill.name }), issues);
      }

      if (platform.hasLocalLibrary && outcome.settled > 0) {
        void useInstalledScanStore.getState().rescan();
      }
    } catch (error) {
      if (isInstallCancelled(error)) return;
      const message = error instanceof Error ? error.message : String(error);
      if (isUnsupportedSkillSource(error)) {
        toast.error(t('skills.install.unsupportedSource', { name: skill.name }), {
          description: t('skills.install.unsupportedSourceDetail'),
        });
      } else if (isNodeRuntimeMissing(message)) {
        toast.error(t('skills.install.nodeMissing'), {
          description: t('skills.install.nodeMissingDetail'),
        });
      } else if (isPermissionError(message)) {
        toast.error(t('skills.install.permissionError'), {
          description: message,
        });
      } else {
        toast.error(
          t(copiesCommand ? 'skills.install.copyFailed' : 'skills.install.failed', {
            name: skill.name,
          }),
          { description: message },
        );
      }
    } finally {
      setInstalling(false);
    }
  };

  if (isInstalled) {
    return (
      <Button
        variant="outline"
        size="sm"
        className={`${SKILL_ACTION_PILL_CLASS} text-teal-700 dark:text-teal-400`}
        onClick={stopCardActivation}
        onPointerDown={stopCardActivation}
        onKeyDown={stopCardActivation}
      >
        <Check size={16} data-icon="inline-end" />
        {t('skills.install.installed')}
      </Button>
    );
  }

  if (installing) {
    return (
      <Button variant="outline" size="sm" className={SKILL_ACTION_PILL_CLASS} disabled>
        {t('skills.install.installing')}
        <Spinner aria-hidden />
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={SKILL_ACTION_PILL_CLASS}
          onClick={stopCardActivation}
          onPointerDown={stopCardActivation}
          onKeyDown={stopCardActivation}
        >
          {t(copiesCommand ? 'skills.install.copyAction' : 'skills.install.action')}
          <ChevronDown size={16} data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => void handleInstall('global')}>
          {t(copiesCommand ? 'skills.install.copyGlobal' : 'skills.install.global')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void handleInstall('project')}>
          {t(copiesCommand ? 'skills.install.copyProject' : 'skills.install.project')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CatalogExternalInfoButton({ skill }: { skill: SkillsShSkill }) {
  const { t } = useTranslation();

  return (
    <Button
      variant="secondary"
      size="icon"
      className="size-7 rounded-full opacity-0 transition-opacity focus-visible:opacity-100 group-hover/card:opacity-100"
      onClick={(event) => {
        stopCardActivation(event);
        void platform.openExternal(skill.url);
      }}
      onPointerDown={stopCardActivation}
      onKeyDown={stopCardActivation}
      aria-label={t('skills.dashboard.openExternalLabel', {
        name: skill.name,
      })}
    >
      <SquareArrowOutUpRight data-icon="inline-start" />
    </Button>
  );
}

function CatalogInstalledMenu({
  snapshot,
  scannedSkill,
}: {
  snapshot: InstalledScanSnapshot;
  scannedSkill: ScannedSkill;
}) {
  const reduceMotion = useReducedMotion() ?? false;

  // The card itself is a dialog trigger, so the menu has to swallow its own events.
  return (
    <div
      onClick={stopCardActivation}
      onPointerDown={stopCardActivation}
      onKeyDown={stopCardActivation}
    >
      <SkillCardOverflowMenu
        skill={scannedSkill}
        snapshot={snapshot}
        providerFilter={ALL_AGENTS_FILTER_ID}
        reduceMotion={reduceMotion}
      />
    </div>
  );
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
          <SkillDetailBody skill={skill} />
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
          <SkillDetailBody skill={skill} />
          <MorphingDialogClose />
        </MorphingDialogContent>
      </MorphingDialogContainer>
    </MorphingDialog>
  );
}
