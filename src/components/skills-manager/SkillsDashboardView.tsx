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
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { cn } from '@/lib/utils';
import {
  DISCOVERY_VIEWS,
  type DiscoveryViewId,
  useSkillsLeaderboard,
  useSkillsSearch,
} from '@/services/skills-sh';
import { useInstalledSkillsUiStore } from '@/store/installed-skills-ui-store';
import { AlertCircle, LayoutGrid, LayoutList, Search, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CatalogSkillCard, CatalogSkillListRow } from './CatalogSkillCard';
import { SkillDetailDialog } from './SkillDetailDialog';

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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
  onOpen,
}: {
  skills: SkillsShSkill[];
  layoutMode: 'grid' | 'list';
  isLoading: boolean;
  error: string | null;
  emptyTitle: string;
  emptyDescription: string;
  onOpen: (skill: SkillsShSkill) => void;
}) {
  const { t } = useTranslation();

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
            ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'
            : 'flex flex-col',
        )}
      >
        {skills.map((skill) =>
          layoutMode === 'grid' ? (
            <CatalogSkillCard key={skill.id} skill={skill} onOpen={onOpen} />
          ) : (
            <CatalogSkillListRow key={skill.id} skill={skill} onOpen={onOpen} />
          ),
        )}
      </div>
    </div>
  );
}

export function SkillsDashboardView() {
  const { t } = useTranslation();
  const [viewId, setViewId] = useState<DiscoveryViewId>('trending');
  const layoutMode = useInstalledSkillsUiStore((state) => state.layoutMode);
  const setLayoutMode = useInstalledSkillsUiStore((state) => state.setLayoutMode);
  const [searchInput, setSearchInput] = useState('');
  const debouncedQuery = useDebouncedValue(searchInput, 300);
  const isSearching = debouncedQuery.trim().length >= 2;
  const search = useSkillsSearch(debouncedQuery, { enabled: isSearching });
  const leaderboard = useSkillsLeaderboard({
    view: viewId,
    perPage: LIST_PER_PAGE,
    enabled: !isSearching,
  });
  const [selectedSkill, setSelectedSkill] = useState<SkillsShSkill | null>(null);

  const activeQuery = isSearching ? search : leaderboard;
  const skills = activeQuery.data ?? [];
  const isRefreshing = activeQuery.isFetching && skills.length > 0;
  const hasSearchError = isSearching && Boolean(search.error);

  return (
    <div className="relative flex h-full min-w-0 flex-col overflow-hidden">
      <div className="app-material border-border sticky top-0 z-10 flex min-w-0 flex-col border-b">
        <div className="flex min-w-0 flex-row flex-wrap items-end justify-between gap-4 p-8 pb-6">
          <div className="flex min-w-0 flex-col items-start gap-3">
            <h1 className="text-2xl leading-none text-balance">{t('skills.dashboard.title')}</h1>
            <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
              {t('skills.dashboard.description')}
            </p>
          </div>
          <InputGroup className="w-full max-w-md shrink-0 rounded-xl">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder={t('skills.dashboard.searchPlaceholder')}
              aria-label={t('skills.dashboard.searchLabel')}
              autoComplete="off"
              spellCheck={false}
            />
            {searchInput ? (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label={t('skills.dashboard.clearSearch')}
                  onClick={() => setSearchInput('')}
                  className="app-pressable"
                >
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
          {hasSearchError ? (
            <Alert variant="destructive" className="max-w-xl">
              <AlertCircle />
              <AlertTitle>{t('skills.dashboard.searchFailed')}</AlertTitle>
              <AlertDescription>{errorMessage(search.error)}</AlertDescription>
            </Alert>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-3 px-8 pb-6">
          <ContinuousTabs
            value={viewId}
            defaultActiveId="trending"
            tabs={DISCOVERY_VIEWS.map((view) => ({
              id: view.id,
              label: view.label,
            }))}
            onChange={(id) => {
              if (id === 'all-time' || id === 'trending' || id === 'hot') {
                setViewId(id);
              }
            }}
          />
          {isRefreshing ? (
            <Spinner
              className="text-muted-foreground size-3.5"
              aria-label={t('skills.dashboard.refreshing')}
            />
          ) : null}
          <ContinuousTabs
            className="ms-auto"
            value={layoutMode}
            defaultActiveId="grid"
            tabs={[
              {
                id: 'list',
                label: t('skills.installed.layoutList'),
                icon: LayoutList,
              },
              {
                id: 'grid',
                label: t('skills.installed.layoutGrid'),
                icon: LayoutGrid,
              },
            ]}
            onChange={(id) => {
              if (id === 'grid' || id === 'list') {
                setLayoutMode(id);
              }
            }}
          />
        </div>
      </div>
      <ScrollArea className="min-h-0 min-w-0 flex-1">
        <div className="flex w-full min-w-0 max-w-full flex-col gap-6 px-6 py-4">
          <SkillsResults
            skills={skills}
            layoutMode={layoutMode}
            isLoading={activeQuery.isLoading}
            error={errorMessage(activeQuery.error)}
            emptyTitle={t('skills.dashboard.noResultsTitle')}
            emptyDescription={t('skills.dashboard.noResultsDescription')}
            onOpen={setSelectedSkill}
          />
        </div>
      </ScrollArea>
      <SkillDetailDialog
        skill={selectedSkill}
        onOpenChange={(open) => {
          if (!open) setSelectedSkill(null);
        }}
        onSelectRelated={(skillId) => {
          setSelectedSkill({
            id: skillId,
            slug: skillId.split('/').at(-1) ?? skillId,
            name: skillId.split('/').at(-1) ?? skillId,
            source: skillId.split('/')[0] ?? '',
            installs: 0,
            sourceType: 'github',
            url: `https://skills.sh/skills/${skillId}`,
          });
        }}
      />
    </div>
  );
}
