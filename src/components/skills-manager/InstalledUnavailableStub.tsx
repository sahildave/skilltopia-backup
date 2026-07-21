import { useTranslation } from 'react-i18next';
import { InstalledToolbar } from './InstalledToolbar';

const skillCount = 0;
const refreshing = false;
const snapshot = null;
const pathInfo = null;
const showUniversalToggle = false;
const showAllUniversal = false;
const layoutMode = 'grid';
const skillQuery = '';
const rescan = () => {};
const setShowAllUniversal = () => {};
const setLayoutMode = () => {};
const setSkillQuery = () => {};

export function InstalledUnavailableStub() {
  const { t } = useTranslation();

  return (
    <>
      <InstalledToolbar
        title={t('skills.installed.title')}
        description={t('skills.installed.description')}
        skillCount={skillCount}
        refreshing={refreshing}
        hasSnapshot={snapshot !== null}
        pathInfo={pathInfo}
        showUniversalToggle={showUniversalToggle}
        showAllUniversal={showAllUniversal}
        layoutMode={layoutMode}
        skillQuery={skillQuery}
        onRescan={() => void rescan()}
        onShowAllUniversalChange={setShowAllUniversal}
        onLayoutModeChange={setLayoutMode}
        onSkillQueryChange={setSkillQuery}
      />
    </>
    // <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
    //   <div className="flex max-w-md flex-col items-center gap-3">
    //     <h1 className="text-3xl leading-none text-balance">{t('skills.installed.title')}</h1>
    //     <p className="text-muted-foreground text-sm text-pretty">
    //       {t('skills.installed.webUnavailable')}
    //     </p>
    //     <p className="text-muted-foreground text-sm text-pretty">
    //       {t('skills.installed.getAppDescription')}
    //     </p>
    //   </div>
    //   <Button size="lg" onClick={() => void platform.openExternal(DESKTOP_APP_DOWNLOAD_URL)}>
    //     {t('skills.installed.getApp')}
    //   </Button>
    // </div>
  );
}
