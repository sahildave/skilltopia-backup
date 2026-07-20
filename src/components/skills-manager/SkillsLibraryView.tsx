import { platform } from '@platform';
import { useTranslation } from 'react-i18next';
import { useInstalledScanStore } from '@/store/installed-scan-store';
import { useInstalledSkillsUiStore } from '@/store/installed-skills-ui-store';
import { UNIVERSAL_PROVIDER_ID } from '@/platform/types';
import {
  ALL_AGENTS_FILTER_ID,
  contentWarningsForSelection,
  filterSkillsForSelection,
} from './installed-skills-model';
import { isPermissionError } from './library-errors';
import { resolveSelectedPath } from './library-path';
import { LibraryContent } from './LibraryContent';
import { LibraryToolbar } from './LibraryToolbar';
import { LibraryUnavailableStub } from './LibraryUnavailableStub';

export function SkillsLibraryView() {
  if (!platform.hasLocalLibrary) {
    return <LibraryUnavailableStub />;
  }

  return <LocalInstalledSkillsView />;
}

function LocalInstalledSkillsView() {
  const { t } = useTranslation();
  const snapshot = useInstalledScanStore((state) => state.snapshot);
  const error = useInstalledScanStore((state) => state.error);
  const refreshing = useInstalledScanStore((state) => state.refreshing);
  const rescan = useInstalledScanStore((state) => state.rescan);
  const providerFilter = useInstalledSkillsUiStore((state) => state.providerFilter);
  const showAllUniversal = useInstalledSkillsUiStore((state) => state.showAllUniversal);
  const setShowAllUniversal = useInstalledSkillsUiStore((state) => state.setShowAllUniversal);
  const layoutMode = useInstalledSkillsUiStore((state) => state.layoutMode);
  const setLayoutMode = useInstalledSkillsUiStore((state) => state.setLayoutMode);

  const showPermissionCard = error !== null && isPermissionError(error);
  const sections = snapshot
    ? filterSkillsForSelection(snapshot, providerFilter, showAllUniversal)
    : null;
  const warnings = snapshot ? contentWarningsForSelection(snapshot, providerFilter) : [];
  const pathInfo = snapshot ? resolveSelectedPath(snapshot, providerFilter) : null;
  const showUniversalToggle =
    providerFilter !== ALL_AGENTS_FILTER_ID && providerFilter !== UNIVERSAL_PROVIDER_ID;
  const skillCount = sections
    ? sections.primary.length + (sections.universalSection?.length ?? 0)
    : null;

  return (
    <div className="relative flex h-full flex-col">
      <LibraryToolbar
        title={t('skills.installed.title')}
        skillCount={skillCount}
        refreshing={refreshing}
        hasSnapshot={snapshot !== null}
        pathInfo={pathInfo}
        showUniversalToggle={showUniversalToggle}
        showAllUniversal={showAllUniversal}
        layoutMode={layoutMode}
        onRescan={() => void rescan()}
        onShowAllUniversalChange={setShowAllUniversal}
        onLayoutModeChange={setLayoutMode}
      />
      <LibraryContent
        snapshot={snapshot}
        error={error}
        showPermissionCard={showPermissionCard}
        refreshing={refreshing}
        warnings={warnings}
        sections={sections}
        providerFilter={providerFilter}
        layoutMode={layoutMode}
        onRescan={() => void rescan()}
      />
    </div>
  );
}
