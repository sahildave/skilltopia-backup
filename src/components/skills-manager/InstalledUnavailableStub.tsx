import { Button } from '@/components/ui/button';
import { DitherGradient } from '../dither-kit';
import { DESKTOP_APP_DOWNLOAD_URL } from '@/lib/desktop-download';
import { platform } from '@platform';
import { useTranslation } from 'react-i18next';

interface InstalledUnavailableStubProps {
  titleKey?: string;
  unavailableKey?: string;
  descriptionKey?: string;
  actionKey?: string;
}

export function InstalledUnavailableStub({
  titleKey = 'skills.installed.title',
  unavailableKey = 'skills.installed.webUnavailable',
  descriptionKey = 'skills.installed.getAppDescription',
  actionKey = 'skills.installed.getApp',
}: InstalledUnavailableStubProps) {
  const { t } = useTranslation();

  return (
    <div className="relative flex h-full flex-col items-center justify-center gap-4 overflow-hidden p-6 text-center">
      <DitherGradient from="grey" direction="down" />

      <div className="relative flex max-w-md flex-col items-center gap-3">
        <h1 className="text-3xl leading-none text-balance">{t(titleKey)}</h1>
        <p className="text-muted-foreground text-sm text-pretty">{t(unavailableKey)}</p>
        <p className="text-muted-foreground text-sm text-pretty">{t(descriptionKey)}</p>
      </div>
      <Button
        className="relative"
        size="lg"
        onClick={() => void platform.openExternal(DESKTOP_APP_DOWNLOAD_URL)}
      >
        {t(actionKey)}
      </Button>
    </div>
  );
}
