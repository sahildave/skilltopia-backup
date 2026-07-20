import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { panelRowSlideVariants } from '@/lib/animation';
import type { ScannedSkill } from '@/platform/types';
import { useInstalledScanStore } from '@/store/installed-scan-store';
import { platform } from '@platform';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { uninstallAgentScopeFromFilter, type ProviderFilterId } from './installed-skills-model';
import { isPermissionError } from './library-errors';

export function SkillCardOverflowMenu({
  skill,
  providerFilter,
  reduceMotion,
}: {
  skill: ScannedSkill;
  providerFilter: ProviderFilterId;
  reduceMotion: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);
  const copiesCommand = platform.copiesInstallCommand;
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
      <DropdownMenuContent align="end" className="relative flex h-12 min-w-56 flex-col py-0.5">
        <AnimatePresence custom={confirming} mode="popLayout" initial={false}>
          {!confirming ? (
            <motion.div
              key="delete"
              custom={confirming}
              variants={rowVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute inset-1"
            >
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
  );
}
