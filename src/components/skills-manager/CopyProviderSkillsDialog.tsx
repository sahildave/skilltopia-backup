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
import { Progress } from '@/components/ui/progress';
import type {
  BulkCopyProgress,
  CopyProviderSkillsResult,
  InstalledScanSnapshot,
} from '@/platform/types';
import { useInstalledScanStore } from '@/store/installed-scan-store';
import { platform } from '@platform';
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { buildBulkCopyDialogModel, filterProviderOptions } from './installed-skills-model';
import { isPermissionError } from './library-errors';
import { ProviderCheckboxRow } from './ProviderCheckboxRow';
import { ProviderSearchField } from './ProviderSearchField';

/**
 * How long the finished bar rests at 100% before the dialog gives way to the
 * summary. The backend's last per-skill tick and the command's resolve can land
 * in the same frame, so without this hold the user would never see the bar
 * reach the end.
 */
const COMPLETE_HOLD_MS = 500;

/**
 * A refusal is not a failure: the destination lives in the read-only Claude
 * plugin cache, which is managed elsewhere and was never ours to write. It is
 * counted apart so the summary can say so instead of reporting a fault.
 */
function totals(result: CopyProviderSkillsResult) {
  return result.targets.reduce(
    (acc, target) => ({
      copied: acc.copied + target.copied,
      skipped: acc.skipped + target.skipped,
      refused: acc.refused + target.refused,
      failed: acc.failed + target.failed,
    }),
    { copied: 0, skipped: 0, refused: 0, failed: 0 },
  );
}

/**
 * Copy everything one provider owns into other providers.
 *
 * Counts come from the scan snapshot already in memory — no preview call. They
 * are deliberately narrower than the sidebar badge, which also counts links
 * projected in from elsewhere and Claude Code's plugin skills; only folders the
 * provider owns can be a source, so the description says so. The run
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
  const [query, setQuery] = useState('');
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BulkCopyProgress | null>(null);

  // The query only narrows the list; hidden rows keep their selection.
  const visibleTargets = filterProviderOptions(model.targets, query);
  const selectedCount = selectedIds.size;
  const providerLabel = (providerId: string) =>
    snapshot.providers.find((p) => p.id === providerId)?.name ?? providerId;
  const percentComplete =
    progress && progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  const handleOpenChange = (next: boolean) => {
    // A batch in flight owns the dialog: closing it would strand the summary.
    if (running) return;
    onOpenChange(next);
    if (!next) {
      setSelectedIds(new Set());
      setQuery('');
      setProgress(null);
    }
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
    setProgress(null);
    try {
      const result = await platform.copyProviderSkills(
        sourceProviderId,
        model.skillNames,
        [...selectedIds],
        setProgress,
      );
      // Settle the bar at 100% and let it breathe before the dialog closes, so
      // a completed run reads as finished rather than vanishing mid-progress.
      setProgress((prev) => (prev ? { ...prev, completed: prev.total } : prev));
      await new Promise((resolve) => setTimeout(resolve, COMPLETE_HOLD_MS));

      const { copied, skipped, refused, failed } = totals(result);
      const summary = t('skills.installed.copyAllSummary', { copied, skipped, failed });
      const refusedProviders = result.targets
        .filter((target) => target.refused > 0)
        .map((target) => providerLabel(target.providerId))
        .join(', ');

      if (failed > 0) {
        toast.warning(summary, {
          description: result.targets
            .flatMap((target) => target.issues.slice(0, 3))
            .map((issue) => issue.skillName)
            .join(', '),
        });
      } else if (refused > 0) {
        toast.warning(summary, {
          description: t('skills.installed.copyRefusedDescription', {
            providers: refusedProviders,
          }),
        });
      } else {
        toast.success(summary);
      }

      setRunning(false);
      onOpenChange(false);
      setSelectedIds(new Set());
      setProgress(null);
      await rescan();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRunning(false);
      setProgress(null);
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

        {model.targets.length > 0 && !running && (
          <ProviderSearchField query={query} onQueryChange={setQuery} />
        )}

        <div className="flex max-h-[min(60vh,24rem)] flex-col gap-4 overflow-y-auto">
          {model.targets.length === 0 ? (
            <p className="text-muted-foreground text-sm text-pretty">
              {t('skills.installed.copyAllNoTargets')}
            </p>
          ) : visibleTargets.length === 0 ? (
            <p className="text-muted-foreground text-sm text-pretty">
              {t('skills.installed.noMatchingProviders')}
            </p>
          ) : (
            <FieldSet>
              <FieldGroup data-slot="checkbox-group" className="gap-3">
                {visibleTargets.map((target) => (
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
          )}
        </div>

        {running && (
          <div className="flex flex-col gap-1.5">
            <Progress value={percentComplete} />
            <p className="text-muted-foreground truncate text-sm">
              {progress && progress.skillName
                ? t('skills.installed.copyAllProgress', {
                    completed: progress.completed,
                    total: progress.total,
                    name: progress.skillName,
                  })
                : t('skills.installed.copyAllRunning')}
            </p>
          </div>
        )}

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
