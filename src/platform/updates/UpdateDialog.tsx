import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Spinner } from '@/components/ui/spinner';
import type { UpdateState } from './types';

export interface UpdateDialogProps {
  state: UpdateState;
  open: boolean;
  onInstall: () => void;
  onDismiss: () => void;
  onRestart: () => void;
  onRetry: () => void;
}

function formatBytes(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

/**
 * Non-modal update surface. It renders from `UpdateState` alone — no Tauri call,
 * no timer, no fetch — so every affordance is reachable in a render test.
 */
export function UpdateDialog({
  state,
  open,
  onInstall,
  onDismiss,
  onRestart,
  onRetry,
}: UpdateDialogProps) {
  const { t } = useTranslation();

  if (!open || state.status === 'idle') return null;

  return (
    <div
      role="dialog"
      aria-modal={false}
      aria-labelledby="update-dialog-title"
      data-slot="update-dialog"
      data-status={state.status}
      className="app-material-strong bg-background fixed end-4 bottom-4 z-50 flex w-80 flex-col gap-3 rounded-[min(var(--radius-4xl),24px)] border p-4 text-start shadow-lg"
    >
      <h2 id="update-dialog-title" className="font-sans text-sm font-semibold">
        {state.status === 'checking' && t('update.title.checking')}
        {state.status === 'upToDate' && t('update.title.upToDate')}
        {state.status === 'available' &&
          t('update.title.available', { version: state.candidate.version })}
        {state.status === 'downloading' && t('update.title.downloading')}
        {state.status === 'readyToRestart' && t('update.title.readyToRestart')}
        {state.status === 'failed' && t('update.title.failed')}
      </h2>

      {state.status === 'checking' && (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Spinner className="size-4" />
          {t('update.description.checking')}
        </p>
      )}

      {state.status === 'upToDate' && (
        <p className="text-muted-foreground text-sm">{t('update.description.upToDate')}</p>
      )}

      {state.status === 'available' && (
        <p className="text-muted-foreground text-sm">
          {t('update.description.available', {
            version: state.candidate.version,
            currentVersion: state.candidate.currentVersion,
          })}
        </p>
      )}

      {state.status === 'downloading' && (
        <div className="flex flex-col gap-2">
          {state.progress.totalBytes === null ? (
            <>
              <Progress aria-label={t('update.progress.indeterminate')} />
              <p className="text-muted-foreground text-sm">{t('update.progress.indeterminate')}</p>
            </>
          ) : (
            <>
              <Progress
                aria-label={t('update.title.downloading')}
                value={Math.min(
                  100,
                  Math.round((state.progress.downloadedBytes / state.progress.totalBytes) * 100),
                )}
              />
              <p className="text-muted-foreground text-sm">
                {t('update.progress.size', {
                  downloaded: formatBytes(state.progress.downloadedBytes),
                  total: formatBytes(state.progress.totalBytes),
                })}
              </p>
            </>
          )}
        </div>
      )}

      {state.status === 'readyToRestart' && (
        <p className="text-muted-foreground text-sm">
          {t('update.description.readyToRestart', { version: state.candidate.version })}
        </p>
      )}

      {state.status === 'failed' && (
        <p className="text-muted-foreground text-sm">{t(`update.error.${state.error.code}`)}</p>
      )}

      <div className="flex flex-row justify-end gap-2">
        {state.status === 'available' && (
          <>
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              {t('update.action.later')}
            </Button>
            <Button size="sm" onClick={onInstall}>
              {t('update.action.install')}
            </Button>
          </>
        )}

        {state.status === 'readyToRestart' && (
          <>
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              {t('update.action.later')}
            </Button>
            <Button size="sm" onClick={onRestart}>
              {t('update.action.restart')}
            </Button>
          </>
        )}

        {state.status === 'failed' && (
          <>
            <Button variant="ghost" size="sm" onClick={onDismiss}>
              {t('update.action.dismiss')}
            </Button>
            <Button size="sm" onClick={onRetry}>
              {t('update.action.retry')}
            </Button>
          </>
        )}

        {state.status === 'upToDate' && (
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            {t('update.action.close')}
          </Button>
        )}
      </div>
    </div>
  );
}
