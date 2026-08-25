import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldGroup, FieldSet } from '@/components/ui/field';
import type { CopyProviderSkillsResult, InstalledScanSnapshot } from '@/platform/types';
import { useInstalledScanStore } from '@/store/installed-scan-store';
import { platform } from '@platform';
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { buildBulkCopyDialogModel } from './installed-skills-model';
import { isPermissionError } from './library-errors';
import { ProviderCheckboxRow } from './ProviderCheckboxRow';

function totals(result: CopyProviderSkillsResult) {
  return result.targets.reduce(
    (acc, target) => ({
      copied: acc.copied + target.copied,
      skipped: acc.skipped + target.skipped,
      failed: acc.failed + target.failed + target.refused,
    }),
    { copied: 0, skipped: 0, failed: 0 },
  );
}

/**
 * Copy everything one provider owns into other providers.
 *
 * Counts come from the scan snapshot already in memory — no preview call — so
 * the numbers the user reads are the same ones the sidebar shows. The run
 * itself is one backend call; it can take a while over 178 skills, so the
 * dialog holds itself open until it settles rather than leaving a half-finished
 * batch behind a dismissed dialog.
 */
export function CopyProviderSkillsDialog({
  sourceProviderId,
  sourceProviderName,
  snapshot,
  open,
  onOpenChange,
}: {
  sourceProviderId: string;
  sourceProviderName: string;
  snapshot: InstalledScanSnapshot;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const rescan = useInstalledScanStore((state) => state.rescan);
  const model = buildBulkCopyDialogModel(snapshot, sourceProviderId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [running, setRunning] = useState(false);

  const selectedCount = selectedIds.size;

  const handleOpenChange = (next: boolean) => {
    // A batch in flight owns the dialog: closing it would strand the summary.
    if (running) return;
    onOpenChange(next);
    if (!next) setSelectedIds(new Set());
  };

  const toggleId = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedCount === 0 || model.skillNames.length === 0) return;
    setRunning(true);
    try {
      const result = await platform.copyProviderSkills(sourceProviderId, model.skillNames, [
        ...selectedIds,
      ]);
      const { copied, skipped, failed } = totals(result);

      if (failed > 0) {
        toast.warning(t('skills.installed.copyAllSummary', { copied, skipped, failed }), {
          description: result.targets
            .flatMap((target) => target.issues.slice(0, 3))
            .map((issue) => issue.skillName)
            .join(', '),
        });
      } else {
        toast.success(t('skills.installed.copyAllSummary', { copied, skipped, failed }));
      }

      setRunning(false);
      onOpenChange(false);
      setSelectedIds(new Set());
      await rescan();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRunning(false);
      if (isPermissionError(message)) {
        toast.error(t('skills.install.permissionError'), { description: message });
      } else {
        toast.error(t('skills.installed.copyAllFailed', { name: sourceProviderName }), {
          description: message,
        });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={!running}>
        <DialogHeader className="-space-y-1">
          <DialogTitle className="truncate text-balance line-clamp-1 font-semibold leading-normal">
            {t('skills.installed.copyAllTitle', { name: sourceProviderName })}
          </DialogTitle>
          <DialogDescription>
            {t('skills.installed.copyAllDescription', {
              name: sourceProviderName,
              count: model.skillNames.length,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[min(60vh,24rem)] flex-col gap-4 overflow-y-auto">
          {model.targets.length > 0 ? (
            <FieldSet>
              <FieldGroup data-slot="checkbox-group" className="gap-3">
                {model.targets.map((target) => (
                  <ProviderCheckboxRow
                    key={target.id}
                    option={target}
                    checked={selectedIds.has(target.id)}
                    disabled={running}
                    description={t('skills.installed.copyAllTargetCounts', {
                      toCopy: target.toCopy,
                      alreadyThere: target.alreadyThere,
                    })}
                    onCheckedChange={(checked) => toggleId(target.id, checked)}
                  />
                ))}
              </FieldGroup>
            </FieldSet>
          ) : (
            <p className="text-muted-foreground text-sm text-pretty">
              {t('skills.installed.copyAllNoTargets')}
            </p>
          )}
        </div>

        <DialogFooter className="sm:items-center sm:justify-between">
          <p className="text-muted-foreground text-sm text-pretty">
            {running
              ? t('skills.installed.copyAllRunning')
              : t('skills.installed.copySummary', { count: selectedCount })}
          </p>
          <Button
            type="button"
            disabled={selectedCount === 0 || running}
            onClick={() => void handleSubmit()}
          >
            {running ? (
              <>
                <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                {t('skills.installed.copyAllRunning')}
              </>
            ) : (
              t('skills.installed.copySubmit')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
