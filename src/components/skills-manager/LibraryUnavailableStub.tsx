import { Button } from '@/components/ui/button';
import { DESKTOP_APP_DOWNLOAD_URL } from '@/lib/desktop-download';
import { platform } from '@platform';
import { useTranslation } from 'react-i18next';

export function LibraryUnavailableStub() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex max-w-md flex-col items-center gap-3">
        <h1 className="text-3xl leading-none text-balance">{t('skills.installed.title')}</h1>
        <p className="text-muted-foreground text-sm text-pretty">
          {t('skills.installed.webUnavailable')}
        </p>
        <p className="text-muted-foreground text-sm text-pretty">
          {t('skills.installed.getAppDescription')}
        </p>
      </div>
      <Button size="lg" onClick={() => void platform.openExternal(DESKTOP_APP_DOWNLOAD_URL)}>
        {t('skills.installed.getApp')}
      </Button>
    </div>
  );
}
