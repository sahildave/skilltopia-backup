import type { SkillsShSkill } from '@/catalog/types';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { InstalledScanSnapshot, ScannedSkill } from '@/platform/types';
import { useInstalledScanStore } from '@/store/installed-scan-store';
import { platform } from '@platform';
import { Check, ChevronDown, FolderOpen, SquareArrowOutUpRight } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { useState, type ReactNode, type SyntheticEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { catalogInstallName, isCatalogSkillInstalled } from './catalog-installed-match';
import { ALL_AGENTS_FILTER_ID, type ProviderFilterId } from './installed-skills-model';
import {
  isInstallCancelled,
  isGitRuntimeMissing,
  isPermissionError,
  isUnsupportedSkillSource,
} from './library-errors';
import { SkillCardOverflowMenu } from './SkillCardOverflowMenu';
import { SKILL_ACTION_PILL_CLASS } from './skill-chip';
import { useSkillDetailDialogClose } from './skill-detail-dialog-close';
import { summarizeTargetResults } from './target-results';
import type { InstallScope } from './types';

function stopCardActivation(event: SyntheticEvent) {
  event.stopPropagation();
}

/**
 * Resolve after the browser has laid the page out again.
 *
 * React batches everything in one task into a single commit, so settling the
 * pill and closing the dialog together swap the card's footer in the very commit
 * the dialog animates back into it. Motion measures the pre-swap box and parks
 * the card outside its grid slot. One frame apart, each gets its own layout.
 */
function afterNextLayout(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** Non-interactive "this is already on disk" pill; the card behind it stays inert. */
function InstalledStatePill({ label, trailing }: { label: string; trailing?: ReactNode }) {
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
      {label}
      {trailing}
    </Button>
  );
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
  const closeDetailDialog = useSkillDetailDialogClose();
  const copiesCommand = platform.copiesInstallCommand;
  const isInstalled = isCatalogSkillInstalled(skill, installedKeys);
  const installName = catalogInstallName(skill);
  const projectInstall = useInstalledScanStore((state) =>
    installName ? (state.projectInstalls[installName] ?? null) : null,
  );

  const handleInstall = async (scope: InstallScope) => {
    setInstalling(true);
    try {
      const result = await platform.install(
        {
          id: skill.id,
          name: skill.name,
          installUrl: skill.installUrl,
        },
        scope,
      );
      const outcome = summarizeTargetResults(result);
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

      // Both branches settle the pill before the dialog closes: dismissing any
      // earlier would tear the dialog down while it still reads "Install".
      if (platform.hasLocalLibrary && outcome.settled > 0) {
        if (result.projectPath && installName) {
          // A rescan would be pointless here — it walks the home roots, and this
          // landed in a folder only the projects scan knows about.
          useInstalledScanStore.getState().recordProjectInstall(installName, result.projectPath);
        } else {
          await useInstalledScanStore.getState().rescan();
        }
        if (outcome.unsettled === 0) {
          await afterNextLayout();
          closeDetailDialog();
        }
      }
    } catch (error) {
      if (isInstallCancelled(error)) return;
      const message = error instanceof Error ? error.message : String(error);
      if (isUnsupportedSkillSource(error)) {
        toast.error(t('skills.install.unsupportedSource', { name: skill.name }), {
          description: t('skills.install.unsupportedSourceDetail'),
        });
      } else if (isGitRuntimeMissing(message)) {
        toast.error(t('skills.install.gitMissing'), {
          description: t('skills.install.gitMissingDetail'),
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
    return <InstalledStatePill label={t('skills.install.installed')} />;
  }

  // Global wins when a skill is in both: the home roots are what every agent reads.
  if (projectInstall) {
    return (
      <InstalledStatePill
        label={t('skills.install.inProject')}
        trailing={<FolderOpen size={16} data-icon="inline-start" />}
      />
    );
  }

  // The trigger stays mounted through the install. Unmounting it from inside
  // `onSelect` aborts Radix's close sequence, which leaves the body inert
  // (`pointer-events: none` plus `aria-hidden` on every other layer) with
  // nothing left to clean it up — the whole app freezes. `modal={false}` keeps
  // Radix from taking that lock in the first place.
  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={SKILL_ACTION_PILL_CLASS}
          disabled={installing}
          onClick={stopCardActivation}
          onPointerDown={stopCardActivation}
          onKeyDown={stopCardActivation}
        >
          {installing ? (
            <>
              {t('skills.install.installing')}
              <Spinner aria-hidden />
            </>
          ) : (
            <>
              {t(copiesCommand ? 'skills.install.copyAction' : 'skills.install.action')}
              <ChevronDown size={16} data-icon="inline-end" />
            </>
          )}
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

export function CatalogExternalInfoButton({
  skill,
  className,
}: {
  skill: SkillsShSkill;
  className?: string;
}) {
  const { t } = useTranslation();

  return (
    <Button
      variant="secondary"
      size="icon"
      className={cn(
        'size-7 rounded-full opacity-0 transition-opacity focus-visible:opacity-100 group-hover/card:opacity-100',
        className,
      )}
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

export function CatalogInstalledMenu({
  snapshot,
  scannedSkill,
  providerFilter = ALL_AGENTS_FILTER_ID,
}: {
  snapshot: InstalledScanSnapshot;
  scannedSkill: ScannedSkill;
  providerFilter?: ProviderFilterId;
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
        providerFilter={providerFilter}
        reduceMotion={reduceMotion}
      />
    </div>
  );
}
