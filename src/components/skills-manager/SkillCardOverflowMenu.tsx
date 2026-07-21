import { Button } from '@/components/ui/button';

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
import { Copy, MoreHorizontal, Trash2 } from 'lucide-react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CopyProvidersDialog } from './CopyProvidersDialog';
import { uninstallAgentScopeFromFilter, type ProviderFilterId } from './installed-skills-model';
import { isPermissionError } from './library-errors';
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

  const closeMenu = useCallback(() => {
    setOpen(false);
    setConfirming(false);
  }, []);

  const { ref } = useActionMenuDismiss({ open, onOpenChange: closeMenu });

  const handleUninstall = async () => {
    setUninstalling(true);
    try {
      await platform.uninstall(skill.uninstallName, {
        agentScope: uninstallAgentScopeFromFilter(providerFilter),
        providerIds: skill.providerIds,
      });
      toast.success(
        t(
          copiesCommand ? 'skills.installed.uninstallCopied' : 'skills.installed.uninstallSuccess',
          { name: skill.name },
        ),
      );
      setOpen(false);
      setConfirming(false);
      await rescan();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isPermissionError(message)) {
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
      <ActionMenuRoot ref={ref}>
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
                        onClick={() => void handleUninstall()}
                        className="flex-1 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Yes, Delete
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={uninstalling}
                        onClick={() => setConfirming(false)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
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
