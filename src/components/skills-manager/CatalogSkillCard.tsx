import type { SkillsShSkill } from '@/catalog/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { Check, ChevronDown, Info } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { isCatalogSkillInstalled } from './catalog-installed-match';
import { isInstallCancelled, isPermissionError } from './library-errors';
import { SkillDetailBody } from './SkillDetailDialog';
import { SkillProviderBadges } from './SkillProviderBadges';
import { SkillSurfaceCard } from './SkillSurfaceCard';
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
      await platform.install(
        {
          id: skill.id,
          name: skill.name,
          installUrl: skill.installUrl,
        },
        scope,
      );
      toast.success(
        t(copiesCommand ? 'skills.install.copied' : 'skills.install.success', {
          name: skill.name,
        }),
      );
      if (platform.hasLocalLibrary) {
        void useInstalledScanStore.getState().rescan();
      }
    } catch (error) {
      if (isInstallCancelled(error)) return;
      const message = error instanceof Error ? error.message : String(error);
      if (isPermissionError(message)) {
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
        className="text-teal-700 dark:text-teal-500 bg-transparent shadow-none border-none"
        onClick={stopCardActivation}
        onPointerDown={stopCardActivation}
        onKeyDown={stopCardActivation}
      >
        <Check size={16} data-icon="inline-end" />
        {t('skills.install.installed')}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={installing}
          onClick={stopCardActivation}
          onPointerDown={stopCardActivation}
          onKeyDown={stopCardActivation}
        >
          {t(copiesCommand ? 'skills.install.copyAction' : 'skills.install.action')}
          <ChevronDown size={16} data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={installing} onSelect={() => void handleInstall('global')}>
          {t(copiesCommand ? 'skills.install.copyGlobal' : 'skills.install.global')}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={installing} onSelect={() => void handleInstall('project')}>
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
      variant="ghost"
      size="icon"
      className="size-7"
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
      <Info data-icon="inline-start" />
    </Button>
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
  const showProviderBadges = isInstalled && snapshot !== null && scannedSkill !== undefined;

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
              showProviderBadges ? (
                <SkillProviderBadges skill={scannedSkill} snapshot={snapshot} />
              ) : (
                <CatalogExternalInfoButton skill={skill} />
              )
            }
            footerTrailing={<SkillInstallMenu skill={skill} installedKeys={installedKeys} />}
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
}: {
  skill: SkillsShSkill;
  installedKeys: Set<string>;
}) {
  const { t } = useTranslation();

  return (
    <MorphingDialog transition={MORPH_TRANSITION}>
      <MorphingDialogTrigger asChild>
        <div data-slot="catalog-skill-list-row">
          <Card className="flex flex-row items-center ring-1 ring-foreground/5 dark:ring-foreground/10  rounded-[min(var(--radius-4xl),24px)] gap-3 py-(--card-spacing) [--card-spacing:--spacing(5)] px-4 hover:scale-101 transition-all hover:bg-linear-to-t hover:from-secondary hover:via-background hover:to-background dark:hover:bg-linear-to-t dark:hover:from-primary/10 dark:hover:via-secondary/30 dark:hover:to-transparent">
            <div className="flex flex-1 gap-1.5 flex-col">
              <MorphingDialogTitle>{skill.name}</MorphingDialogTitle>
              <MorphingDialogSubtitle>{skill.source}</MorphingDialogSubtitle>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Badge variant="secondary" size="md">
                {formatInstalls(skill.installs)}
              </Badge>

              <Button
                variant="ghost"
                size="icon"
                className="size-7"
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
                <Info data-icon="inline-start" />
              </Button>
              <SkillInstallMenu skill={skill} installedKeys={installedKeys} />
            </div>
          </Card>
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
