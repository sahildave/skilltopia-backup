import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { panelRowSlideVariants } from '@/lib/animation';
import type { InstalledScanSnapshot, ScannedSkill } from '@/platform/types';
import { useInstalledScanStore } from '@/store/installed-scan-store';
import { platform } from '@platform';
import { Copy, MoreHorizontal, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
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

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setConfirming(false);
    }
  };

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
      <DropdownMenu open={open} onOpenChange={handleOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="shrink-0"
            aria-label={t('skills.installed.overflowMenu')}
            disabled={uninstalling}
          >
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className={
            confirming
              ? 'relative flex h-12 min-w-56 flex-col py-0.5'
              : 'flex min-w-56 flex-col py-0.5'
          }
        >
          <AnimatePresence custom={confirming} mode="popLayout" initial={false}>
            {!confirming ? (
              <motion.div
                key="actions"
                custom={confirming}
                variants={rowVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="flex flex-col"
              >
                {canCopy ? (
                  <DropdownMenuItem
                    disabled={uninstalling}
                    onSelect={() => {
                      setOpen(false);
                      setCopyOpen(true);
                    }}
                  >
                    <Copy aria-hidden />
                    {t('skills.installed.copyToProviders')}
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  variant="destructive"
                  disabled={uninstalling}
                  onSelect={(event) => {
                    event.preventDefault();
                    setConfirming(true);
                    setOpen(true);
                  }}
                >
                  <Trash2 aria-hidden />
                  {t('skills.installed.uninstall')}
                </DropdownMenuItem>
              </motion.div>
            ) : (
              <motion.div
                key="confirm"
                custom={confirming}
                variants={rowVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="absolute inset-x-0 flex items-center gap-2"
              >
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="flex-1"
                  disabled={uninstalling}
                  onClick={() => void handleUninstall()}
                >
                  {t('skills.installed.uninstallYes')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={uninstalling}
                  onClick={() => setConfirming(false)}
                >
                  {t('skills.installed.uninstallCancel')}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </DropdownMenuContent>
      </DropdownMenu>

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
