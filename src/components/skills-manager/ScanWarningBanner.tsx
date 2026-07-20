import { Button } from '@/components/ui/button';
import type { ScanWarning } from '@/platform/types';
import { platform } from '@platform';
import { AlertTriangle, FolderOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { warningRevealProviderId } from './installed-skills-model';

export function ScanWarningBanner({ warning }: { warning: ScanWarning }) {
  const { t } = useTranslation();
  const revealId = warningRevealProviderId(warning);

  return (
    <div className="bg-amber-500/10 text-amber-950 dark:text-amber-100 flex items-start justify-between gap-3 rounded-md px-3 py-2 text-sm">
      <div className="flex min-w-0 items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="text-pretty">{warning.message}</p>
      </div>
      {revealId ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 border-amber-600/30 bg-background/80 hover:bg-background"
          onClick={() => void platform.revealProviderSkillsDir(revealId)}
        >
          <FolderOpen className="size-3.5" aria-hidden />
          {t('skills.installed.openFolder')}
        </Button>
      ) : null}
    </div>
  );
}
