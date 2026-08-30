import type { SkillsShSkill } from '@/catalog/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { ContinuousTabs } from '@/components/ui/continuous-tabs';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useCollapsibleHeader } from '@/hooks/use-collapsible-header';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/utils';
import {
  collectCachedLeaderboardSkillsFromClient,
  filterSkillsLocally,
  mergeLocalAndApiSkills,
  shouldMergeApiResults,
} from '@/services/local-skills-search';
import {
  DISCOVERY_VIEWS,
  type DiscoveryViewId,
  useSkillsLeaderboard,
  useSkillsSearch,
} from '@/services/skills-sh';
import { useInstalledScanStore } from '@/store/installed-scan-store';
import { useInstalledSkillsUiStore } from '@/store/installed-skills-ui-store';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Search } from 'lucide-react';
import { useState } from 'react';
import type { SkillCategory } from '../../../api/_lib/taxonomy';
import { useTranslation } from 'react-i18next';
import { CatalogSkillCard, CatalogSkillListRow } from './CatalogSkillCard';
import { InstalledToolbar } from './InstalledToolbar';
import { SkillCategoryFilter } from './SkillCategoryFilter';
import {
  findScannedSkillForCatalog,
  installedSkillKeysFromSnapshot,
  scannedSkillsByKey,
} from './catalog-installed-match';

const LIST_PER_PAGE = 100;

function errorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : error ? String(error) : null;
}

function SkillsSkeleton({ layoutMode }: { layoutMode: 'grid' | 'list' }) {
  if (layoutMode === 'list') {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 p-2">
      {Array.from({ length: 6 }, (_, index) => (
        <Card key={index} className="gap-4 py-4">
          <CardHeader className="px-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </CardHeader>
          <CardContent className="px-4">
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          </CardContent>
          <CardFooter className="border-t px-4 pt-4">
            <Skeleton className="ml-auto h-8 w-16" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

function SkillsResults({
  skills,
  layoutMode,
  isLoading,
  error,
  emptyTitle,
  emptyDescription,
}: {
  skills: SkillsShSkill[];
  layoutMode: 'grid' | 'list';
  isLoading: boolean;
  error: string | null;
  emptyTitle: string;
  emptyDescription: string;
}) {
  const { t } = useTranslation();
  const snapshot = useInstalledScanStore((state) => state.snapshot);
  const installedKeys = installedSkillKeysFromSnapshot(snapshot);
  const scannedByKey = scannedSkillsByKey(snapshot?.skills ?? []);

  if (isLoading && skills.length === 0) {
    return <SkillsSkeleton layoutMode={layoutMode} />;
  }

  if (error && skills.length === 0) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>{t('skills.dashboard.loadFailed')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (skills.length === 0) {
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Search />
          </EmptyMedia>
          <EmptyTitle>{emptyTitle}</EmptyTitle>
          <EmptyDescription>{emptyDescription}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{t('skills.dashboard.refreshFailed')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div
        data-testid="discovery-skill-container"
        data-layout={layoutMode}
        className={cn(
          layoutMode === 'grid'
            ? 'grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3'
            : 'flex flex-col space-y-3',
        )}
      >
        {skills.map((skill) =>
          layoutMode === 'grid' ? (
            <CatalogSkillCard
              key={skill.id}
              skill={skill}
              installedKeys={installedKeys}
              snapshot={snapshot}
              scannedSkill={findScannedSkillForCatalog(skill, scannedByKey)}
            />
          ) : (
            <CatalogSkillListRow
              key={skill.id}
              skill={skill}
              installedKeys={installedKeys}
              snapshot={snapshot}
              scannedSkill={findScannedSkillForCatalog(skill, scannedByKey)}
            />
          ),
        )}
      </div>
    </div>
  );
}

const API_SEARCH_DEBOUNCE_MS = 450;

export function SkillsDashboardView() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { viewportRef, collapsed, headerHeight, onExpandedHeightChange } = useCollapsibleHeader();
  const [viewId, setViewId] = useState<DiscoveryViewId>('trending');
  const layoutMode = useInstalledSkillsUiStore((state) => state.layoutMode);
  const setLayoutMode = useInstalledSkillsUiStore((state) => state.setLayoutMode);
  const [searchInput, setSearchInput] = useState('');
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const isSearchView = searchInput.trim().length >= 2;
  const debouncedApiQuery = useDebouncedValue(searchInput, API_SEARCH_DEBOUNCE_MS);
  const apiInSync = shouldMergeApiResults(searchInput, debouncedApiQuery);
  const search = useSkillsSearch(debouncedApiQuery, {
    enabled: isSearchView && apiInSync,
    categories,
  });
  const leaderboard = useSkillsLeaderboard({
    view: viewId,
    perPage: LIST_PER_PAGE,
    enabled: true,
  });

  const cachedCorpus = collectCachedLeaderboardSkillsFromClient(queryClient, leaderboard.data);
  // Cached leaderboard entries carry no categories, so they cannot honour the
  // facet — with one selected, only the API's filtered results are shown.
  const localSkills =
    isSearchView && categories.length === 0 ? filterSkillsLocally(cachedCorpus, searchInput) : [];
  const canMergeApi = apiInSync && Boolean(search.data) && !search.isPlaceholderData;
  const skills = isSearchView
    ? canMergeApi && search.data
      ? mergeLocalAndApiSkills(localSkills, search.data)
      : localSkills
    : (leaderboard.data ?? []);

  const isApiSearching =
    isSearchView &&
    (!apiInSync || search.isFetching || search.isPending || search.isPlaceholderData);
  const isRefreshing = !isSearchView && leaderboard.isFetching && skills.length > 0;
  const hasSearchError = isSearchView && apiInSync && Boolean(search.error);
  const resultsLoading = isSearchView
    ? localSkills.length === 0 && (!apiInSync || search.isLoading)
    : leaderboard.isLoading;
  const resultsError = isSearchView
    ? apiInSync
      ? errorMessage(search.error)
      : null
    : errorMessage(leaderboard.error);

  return (
    <div className="relative flex h-full min-w-0 flex-col overflow-hidden">
      <div className="absolute inset-x-0 top-0 z-20">
        <InstalledToolbar
          title={t('skills.dashboard.title')}
          description={t('skills.dashboard.description')}
          skillCount={null}
          refreshing={isRefreshing}
          collapsed={collapsed}
          onExpandedHeightChange={onExpandedHeightChange}
          layoutMode={layoutMode}
          skillQuery={searchInput}
          onSkillQueryChange={setSearchInput}
          searchPlaceholder={t('skills.dashboard.searchPlaceholder')}
          searchLabel={t('skills.dashboard.searchLabel')}
          clearSearchLabel={t('skills.dashboard.clearSearch')}
          showInstalledControls={false}
          viewTrailingAction={
            isSearchView ? (
              <SkillCategoryFilter selected={categories} onChange={setCategories} />
            ) : null
          }
          leadingAction={
            <ContinuousTabs
              value={viewId}
              defaultActiveId="trending"
              tabs={DISCOVERY_VIEWS.map((view) => ({
                id: view.id,
                label: view.label,
                helpTooltip: t(`skills.dashboard.viewHelp.${view.id}`),
              }))}
              onChange={(id) => {
                if (id === 'all-time' || id === 'trending' || id === 'hot') {
                  setViewId(id);
                }
              }}
            />
          }
          searchError={
            hasSearchError ? (
              <Alert variant="destructive" className="max-w-xl">
                <AlertCircle />
                <AlertTitle>{t('skills.dashboard.searchFailed')}</AlertTitle>
                <AlertDescription>{errorMessage(search.error)}</AlertDescription>
              </Alert>
            ) : null
          }
          onLayoutModeChange={setLayoutMode}
        />
      </div>
      <ScrollArea viewportRef={viewportRef} className="min-h-0 min-w-0 flex-1">
        <div
          className="flex w-full min-w-0 max-w-full flex-col gap-6 px-6 pb-6"
          style={{ paddingTop: (headerHeight ?? 0) + 24 }}
        >
          <SkillsResults
            skills={skills}
            layoutMode={layoutMode}
            isLoading={resultsLoading}
            error={resultsError}
            emptyTitle={t('skills.dashboard.noResultsTitle')}
            emptyDescription={t('skills.dashboard.noResultsDescription')}
          />
        </div>
      </ScrollArea>
      {isApiSearching ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-6 z-20 flex justify-center"
          role="status"
          aria-live="polite"
        >
          <div className="bg-background/95 text-muted-foreground flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm shadow-sm">
            <Spinner className="size-3.5" aria-hidden />
            {t('skills.dashboard.searching')}
          </div>
        </div>
      ) : null}
    </div>
  );
}
