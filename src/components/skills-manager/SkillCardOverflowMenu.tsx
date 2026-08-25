import { Button } from '@/components/ui/button';
import { useMorphingDialogClose } from '@/components/ui/morphing-dialog';
import { Spinner } from '@/components/ui/spinner';

import {
  ActionMenuContent,
  ActionMenuItem,
  ActionMenuPanel,
  ActionMenuRoot,
  ActionMenuTrigger,
  useActionMenuDismiss,
} from '@/components/ui/action-menu';
import { panelRowSlideVariants } from '@/lib/animation';
import type { InstalledScanSnapshot, ScannedSkill } from '@/platform/types';
import { useInstalledScanStore } from '@/store/installed-scan-store';
import { platform } from '@platform';
import { Check, ChevronDown, Copy, Puzzle, Trash2 } from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CopyProvidersDialog } from './CopyProvidersDialog';
import {
  isPluginManagedSkill,
  pluginOriginLabel,
  pluginOriginsForSkill,
  uninstallAgentScopeFromFilter,
  type ProviderFilterId,
} from './installed-skills-model';
import { isPermissionError, isPluginManaged } from './library-errors';
import { SKILL_ACTION_PILL_CLASS } from './skill-chip';
import { summarizeTargetResults } from './target-results';
export function SkillCardOverflowMenu({
  skill,
  snapshot,
  providerFilter,
  reduceMotion,
}: {
  skill: ScannedSkill;
  snapshot: InstalledScanSnapshot;
  providerFilter: ProviderFilterId;
  reduceMotion: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [copyOpen, setCopyOpen] = useState(false);
  // Shared, not local: this skill's card and the detail dialog opened from it
  // each render their own menu, and the dialog closes while the uninstall is
  // still running — the card behind it has to pick the pending state up.
  const uninstalling = useInstalledScanStore((state) => state.uninstalling.has(skill.name));
  const copiesCommand = platform.copiesInstallCommand;
  const canCopy = platform.hasLocalLibrary;
  const rescan = useInstalledScanStore((state) => state.rescan);
  // A no-op on a plain card. Inside the detail dialog it must run before the
  // rescan: the dialog morphs from this skill's own card, so mutating that card
  // under an open dialog makes motion hand the morph back to it — the dialog
  // goes invisible while still open, leaving its backdrop over the whole app.
  const closeDetailDialog = useMorphingDialogClose();
  const rowVariants = panelRowSlideVariants(Boolean(reduceMotion));
  // The plugin cache is read-only, so Rust refuses this uninstall. Don't offer
  // an action that can only fail — say who owns the skill instead.
  const pluginManaged = isPluginManagedSkill(skill);
  const owningPlugins = pluginOriginsForSkill(skill).map(pluginOriginLabel).join(', ');

  const closeMenu = useCallback(() => {
    setOpen(false);
    setConfirming(false);
  }, []);

  const { ref } = useActionMenuDismiss({ open, onOpenChange: closeMenu });

  const handleUninstall = async () => {
    setOpen(false);
    setConfirming(false);
    useInstalledScanStore.getState().beginUninstall(skill.name);
    try {
      const outcome = summarizeTargetResults(
        await platform.uninstall(skill.uninstallName, {
          agentScope: uninstallAgentScopeFromFilter(providerFilter),
          providerIds: skill.providerIds,
        }),
      );
      const issues = outcome.issues
        ? { description: t('skills.install.issuesDescription', { providers: outcome.issues }) }
        : undefined;

      if (outcome.unsettled === 0) {
        toast.success(
          t(
            copiesCommand
              ? 'skills.installed.uninstallCopied'
              : 'skills.installed.uninstallSuccess',
            { name: skill.name },
          ),
        );
      } else if (outcome.settled > 0) {
        toast.warning(
          t('skills.installed.uninstallPartial', {
            name: skill.name,
            settled: outcome.settled,
            failed: outcome.unsettled,
          }),
          issues,
        );
      } else {
        toast.error(t('skills.installed.uninstallFailed', { name: skill.name }), issues);
      }

      closeDetailDialog();
      await rescan();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isPluginManaged(message)) {
        toast.error(t('skills.installed.uninstallPluginManaged', { name: skill.name }), {
          description: t('skills.installed.uninstallPluginManagedDetail', {
            plugin: owningPlugins || skill.name,
          }),
        });
      } else if (isPermissionError(message)) {
        toast.error(t('skills.install.permissionError'), {
          description: message,
        });
      } else {
        toast.error(
          t(
            copiesCommand
              ? 'skills.installed.uninstallCopyFailed'
              : 'skills.installed.uninstallFailed',
            { name: skill.name },
          ),
          { description: message },
        );
      }
    } finally {
      useInstalledScanStore.getState().endUninstall(skill.name);
    }
  };

  return (
    <>
      <ActionMenuRoot ref={ref} open={open}>
        {uninstalling ? (
          <Button variant="outline" size="sm" className={SKILL_ACTION_PILL_CLASS} disabled>
            {t('skills.installed.uninstalling')}
            <Spinner aria-hidden />
          </Button>
        ) : (
          <ActionMenuTrigger
            variant="outline"
            size="sm"
            className={`${SKILL_ACTION_PILL_CLASS} text-teal-700 dark:text-teal-400`}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <Check aria-hidden />
            {t('skills.installed.cardInstalled')}
            <ChevronDown aria-hidden />
          </ActionMenuTrigger>
        )}
        <ActionMenuPanel open={open}>
          <LayoutGroup>
            <ActionMenuContent>
              {canCopy ? (
                <ActionMenuItem
                  icon={<Copy aria-hidden />}
                  label={t('skills.installed.copyToProviders')}
                  onClick={() => {
                    setOpen(false);
                    setCopyOpen(true);
                  }}
                />
              ) : null}
              <div className="relative mt-2 h-10 overflow-hidden border-t border-border pt-2">
                {pluginManaged ? (
                  <div className="absolute inset-x-0 top-2">
                    <ActionMenuItem
                      icon={<Puzzle aria-hidden />}
                      label={t('skills.installed.uninstallPluginManagedItem', {
                        plugin: owningPlugins,
                      })}
                      disabled
                    />
                  </div>
                ) : (
                  <AnimatePresence custom={confirming} mode="popLayout" initial={false}>
                    {!confirming ? (
                      <motion.div
                        key="delete"
                        custom={confirming}
                        variants={rowVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="absolute inset-x-0 top-2"
                      >
                        <ActionMenuItem
                          icon={<Trash2 aria-hidden />}
                          label={t('skills.installed.uninstall')}
                          destructive
                          onClick={() => setConfirming(true)}
                        />
                      </motion.div>
                    ) : (
                      <motion.div
                        key="confirm"
                        custom={confirming}
                        variants={rowVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className="absolute inset-x-0 top-2 flex items-center gap-2"
                      >
                        <Button
                          variant="destructive"
                          size="sm"
                          aria-label={t('skills.installed.uninstallYes')}
                          onClick={() => void handleUninstall()}
                          className="flex-1"
                        >
                          {t('skills.installed.uninstallYes')}
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setConfirming(false)}
                          className="flex-1"
                        >
                          {t('skills.installed.uninstallCancel')}
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
              </div>
            </ActionMenuContent>
          </LayoutGroup>
        </ActionMenuPanel>
      </ActionMenuRoot>

      {canCopy ? (
        <CopyProvidersDialog
          skill={skill}
          snapshot={snapshot}
          open={copyOpen}
          onOpenChange={setCopyOpen}
        />
      ) : null}
    </>
  );
}
