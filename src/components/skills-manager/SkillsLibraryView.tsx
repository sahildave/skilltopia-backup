import { getSeedForView } from '@/data/skills-seed';
import { collectCachedLeaderboardSkillsFromClient } from '@/services/local-skills-search';
import { useInstalledScanStore } from '@/store/installed-scan-store';
import { useInstalledSkillsUiStore } from '@/store/installed-skills-ui-store';
import { useCollapsibleHeader } from '@/hooks/use-collapsible-header';
import { platform } from '@platform';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { catalogSourcesByInstalledKey } from './catalog-installed-match';
import { CopyProviderSkillsDialog } from './CopyProviderSkillsDialog';
import {
  ALL_AGENTS_FILTER_ID,
  buildProviderSidebarModel,
  contentWarningsForSelection,
  filterSkillSectionsByQuery,
  filterSkillSectionsByView,
  filterSkillsForSelection,
  ownedSkillsForProvider,
  type InstalledSkillView,
} from './installed-skills-model';
import { InstalledContent } from './InstalledContent';
import { InstalledToolbar } from './InstalledToolbar';
import { InstalledUnavailableStub } from './InstalledUnavailableStub';
import { isPermissionError } from './library-errors';
import { resolveSelectedPath } from './library-path';
import { Button } from '@/components/ui/button';
import { UNIVERSAL_PROVIDER_ID } from '@/platform/types';
import { Copy } from 'lucide-react';

export function SkillsLibraryView() {
  if (!platform.hasLocalLibrary) {
    return <InstalledUnavailableStub />;
  }

  return <LocalInstalledSkillsView />;
}

function LocalInstalledSkillsView() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const snapshot = useInstalledScanStore((state) => state.snapshot);
  const error = useInstalledScanStore((state) => state.error);
  const refreshing = useInstalledScanStore((state) => state.refreshing);
  const rescan = useInstalledScanStore((state) => state.rescan);
  const providerFilter = useInstalledSkillsUiStore((state) => state.providerFilter);
  const layoutMode = useInstalledSkillsUiStore((state) => state.layoutMode);
  const setLayoutMode = useInstalledSkillsUiStore((state) => state.setLayoutMode);
  const { viewportRef, collapsed, headerHeight, onExpandedHeightChange } = useCollapsibleHeader();
  const [skillQuery, setSkillQuery] = useState('');
  const [installedSkillView, setInstalledSkillView] = useState<InstalledSkillView>('all');
  const [copyAllOpen, setCopyAllOpen] = useState(false);

  const showPermissionCard = error !== null && isPermissionError(error);
  const catalogSourcesByKey = catalogSourcesByInstalledKey(
    collectCachedLeaderboardSkillsFromClient(queryClient, getSeedForView('all-time')),
  );
  const providerSections = snapshot ? filterSkillsForSelection(snapshot, providerFilter) : null;
  const viewSections =
    providerSections && snapshot
      ? filterSkillSectionsByView(providerSections, snapshot, installedSkillView)
      : providerSections;
  const sections = viewSections
    ? filterSkillSectionsByQuery(viewSections, skillQuery, catalogSourcesByKey)
    : null;
  const skillCount = sections ? sections.primary.length : null;
  const sidebarModel = snapshot ? buildProviderSidebarModel(snapshot) : null;
  const selectedProviderItem =
    sidebarModel && providerFilter !== ALL_AGENTS_FILTER_ID
      ? [
          sidebarModel.universal,
          ...sidebarModel.activeProviders,
          ...sidebarModel.inactiveProviders,
        ].find((item) => item.id === providerFilter)
      : null;
  const toolbarTitle =
    providerFilter === ALL_AGENTS_FILTER_ID
      ? t('skills.nav.installed')
      : (selectedProviderItem?.name ?? t('skills.nav.installed'));
  const toolbarDesc =
    providerFilter === ALL_AGENTS_FILTER_ID
      ? t('skills.installed.descriptionGlobal')
      : t('skills.installed.description');
  const toolbarCount =
    providerFilter === ALL_AGENTS_FILTER_ID
      ? (sidebarModel?.allAgentsCount ?? null)
      : (selectedProviderItem?.skillCount ?? skillCount);
  const warnings = snapshot ? contentWarningsForSelection(snapshot, providerFilter) : [];
  const pathInfo = snapshot ? resolveSelectedPath(snapshot, providerFilter) : null;
  const hasActiveSkillQuery = skillQuery.trim().length > 0;

  // A bulk copy needs a concrete source provider that actually owns something:
  // not "All agents", not Universal, and not a row with nothing to copy.
  const bulkCopySourceId =
    providerFilter !== ALL_AGENTS_FILTER_ID && providerFilter !== UNIVERSAL_PROVIDER_ID
      ? providerFilter
      : null;
  const canBulkCopy =
    snapshot !== null &&
    bulkCopySourceId !== null &&
    ownedSkillsForProvider(snapshot, bulkCopySourceId).length > 0;

  return (
    <div className="relative flex h-full flex-col">
      <div className="absolute inset-x-0 top-0 z-20">
        <InstalledToolbar
          title={toolbarTitle}
          description={toolbarDesc}
          skillCount={toolbarCount}
          refreshing={refreshing}
          hasSnapshot={snapshot !== null}
          pathInfo={pathInfo}
          layoutMode={layoutMode}
          collapsed={collapsed}
          onExpandedHeightChange={onExpandedHeightChange}
          installedSkillView={installedSkillView}
          skillQuery={skillQuery}
          onRescan={() => void rescan()}
          onLayoutModeChange={setLayoutMode}
          onInstalledSkillViewChange={setInstalledSkillView}
          onSkillQueryChange={setSkillQuery}
          viewTrailingAction={
            canBulkCopy ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={refreshing}
                onClick={() => setCopyAllOpen(true)}
              >
                <Copy data-icon="inline-start" aria-hidden />
                {t('skills.installed.copyAllAction')}
              </Button>
            ) : null
          }
        />
      </div>
      <InstalledContent
        viewportRef={viewportRef}
        contentOffset={headerHeight ?? 0}
        snapshot={snapshot}
        error={error}
        showPermissionCard={showPermissionCard}
        refreshing={refreshing}
        warnings={warnings}
        sections={sections}
        providerFilter={providerFilter}
        layoutMode={layoutMode}
        hasActiveSkillQuery={hasActiveSkillQuery}
        onRescan={() => void rescan()}
      />
      {snapshot && bulkCopySourceId && canBulkCopy ? (
        <CopyProviderSkillsDialog
          sourceProviderId={bulkCopySourceId}
          sourceProviderName={selectedProviderItem?.name ?? bulkCopySourceId}
          snapshot={snapshot}
          open={copyAllOpen}
          onOpenChange={setCopyAllOpen}
        />
      ) : null}
    </div>
  );
}
