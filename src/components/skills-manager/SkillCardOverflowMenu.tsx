import { Button } from '@/components/ui/button';
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
import { Copy, MoreHorizontal, Puzzle, Trash2 } from 'lucide-react';
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
import { isNodeRuntimeMissing, isPermissionError, isPluginManaged } from './library-errors';
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

  const [uninstalling, setUninstalling] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const copiesCommand = platform.copiesInstallCommand;
  const canCopy = platform.hasLocalLibrary;
  const rescan = useInstalledScanStore((state) => state.rescan);
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
    setUninstalling(true);
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

      setOpen(false);
      setConfirming(false);
      await rescan();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isPluginManaged(message)) {
        toast.error(t('skills.installed.uninstallPluginManaged', { name: skill.name }), {
          description: t('skills.installed.uninstallPluginManagedDetail', {
            plugin: owningPlugins || skill.name,
          }),
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
      setUninstalling(false);
    }
  };

  return (
    <>
      <ActionMenuRoot ref={ref} open={open}>
        <ActionMenuTrigger
          aria-label={t('skills.installed.overflowMenu')}
          aria-expanded={open}
          disabled={uninstalling}
          onClick={() => {
            if (uninstalling) {
              return;
            }
            setOpen((value) => !value);
          }}
        >
          <MoreHorizontal aria-hidden />
        </ActionMenuTrigger>
        <ActionMenuPanel open={open}>
          <LayoutGroup>
            <ActionMenuContent>
              {canCopy ? (
                <ActionMenuItem
                  disabled={uninstalling}
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
                          disabled={uninstalling}
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
                          disabled={uninstalling}
                          size="sm"
                          aria-label={t('skills.installed.uninstallYes')}
                          onClick={() => void handleUninstall()}
                          className="flex-1 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {uninstalling ? (
                            <Spinner aria-hidden />
                          ) : (
                            t('skills.installed.uninstallYes')
                          )}
                        </Button>

                        <Button
                          variant="secondary"
                          size="sm"
                          disabled={uninstalling}
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
