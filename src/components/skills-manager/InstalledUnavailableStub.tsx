import { Button } from '@/components/ui/button';
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
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex max-w-md flex-col items-center gap-3">
        <h1 className="text-3xl leading-none text-balance">{t(titleKey)}</h1>
        <p className="text-muted-foreground text-sm text-pretty">{t(unavailableKey)}</p>
        <p className="text-muted-foreground text-sm text-pretty">{t(descriptionKey)}</p>
      </div>
      <Button size="lg" onClick={() => void platform.openExternal(DESKTOP_APP_DOWNLOAD_URL)}>
        {t(actionKey)}
      </Button>
    </div>
  );
}

// import { useTranslation } from 'react-i18next';
// import { InstalledToolbar } from './InstalledToolbar';

// export function InstalledUnavailableStub() {
//   const { t } = useTranslation();
//   const snapshot = null;
//   const refreshing = false;
//   const rescan = () => {};

//   const showAllUniversal = false;
//   const setShowAllUniversal = () => {};
//   const layoutMode = 'grid';
//   const setLayoutMode = () => {};
//   const skillQuery = '';
//   const setSkillQuery = () => {};
//   const skillCount = 0;
//   const pathInfo = null;
//   const showUniversalToggle = false;

//   return (
//     <div className="relative flex h-full flex-col">
//       <InstalledToolbar
//         title={t('skills.installed.title')}
//         description={t('skills.installed.description')}
//         skillCount={skillCount}
//         refreshing={refreshing}
//         hasSnapshot={snapshot !== null}
//         pathInfo={pathInfo}
//         showUniversalToggle={showUniversalToggle}
//         showAllUniversal={showAllUniversal}
//         layoutMode={layoutMode}
//         skillQuery={skillQuery}
//         onRescan={() => void rescan()}
//         onShowAllUniversalChange={setShowAllUniversal}
//         onLayoutModeChange={setLayoutMode}
//         onSkillQueryChange={setSkillQuery}
//       />
//     </div>
//   );
// }
