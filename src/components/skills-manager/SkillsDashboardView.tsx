import type { SkillsShSkill } from '@/catalog/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
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
import { ProgressiveBlur } from '@/components/ui/progressive-blur';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import type { PageSlideDirection } from '@/lib/animation';
import { pageSlideVariants } from '@/lib/animation';
import { DISCOVERY_VIEWS, useSkillsLeaderboard, useSkillsSearch } from '@/services/skills-sh';
import { AlertCircle, Search, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CatalogSkillCard } from './CatalogSkillCard';
import { DiscoveryListView, type DiscoveryViewId } from './DiscoveryListView';
import { SkillDetailDialog } from './SkillDetailDialog';

function SkillsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
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

function errorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : error ? String(error) : null;
}

function DiscoveryRail({
  view,
  onOpen,
  onShowMore,
}: {
  view: (typeof DISCOVERY_VIEWS)[number];
  onOpen: (skill: SkillsShSkill) => void;
  onShowMore: (viewId: DiscoveryViewId) => void;
}) {
  const { t } = useTranslation();
  const query = useSkillsLeaderboard({ view: view.id, perPage: 12 });
  const skills = query.data ?? [];
  const error = errorMessage(query.error);

  return (
    <section
      aria-labelledby={`rail-${view.id}`}
      className="flex w-full min-w-0 max-w-full flex-col gap-3"
    >
      <div className="flex min-w-0 items-baseline justify-between gap-3 px-2">
        <div className="flex min-w-0 flex-row items-baseline gap-2">
          <h3 id={`rail-${view.id}`} className="shrink-0 text-lg">
            {view.label}
          </h3>
          <p className="text-muted-foreground min-w-0 truncate text-xs">
            {view.id === 'all-time'
              ? t('skills.dashboard.rail.allTimeDescription')
              : t('skills.dashboard.rail.currentDescription', {
                  view: view.label,
                })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary" className="tabular-nums">
            {skills.length}
          </Badge>
          {skills.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => onShowMore(view.id)}>
              {t('skills.dashboard.showMore')}
            </Button>
          ) : null}
        </div>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{t('skills.dashboard.refreshFailed')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {query.isLoading && skills.length === 0 ? <SkillsGridSkeleton /> : null}
      {skills.length > 0 ? (
        <div className="relative -mx-6 min-w-0">
          <div className="overflow-x-auto">
            <div className="flex w-max gap-4 px-6 py-1">
              {skills.map((skill) => (
                <CatalogSkillCard key={skill.id} skill={skill} onOpen={onOpen} compact />
              ))}
            </div>
          </div>
          <ProgressiveBlur
            direction="left"
            blurIntensity={1}
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16"
          />
          <ProgressiveBlur
            direction="right"
            blurIntensity={1}
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16"
          />
        </div>
      ) : null}
    </section>
  );
}

function SearchResults({
  query,
  onOpen,
}: {
  query: ReturnType<typeof useSkillsSearch>;
  onOpen: (skill: SkillsShSkill) => void;
}) {
  const { t } = useTranslation();
  const skills = query.data ?? [];
  const error = errorMessage(query.error);
  const isRefreshing = query.isFetching && skills.length > 0;
  if (query.isLoading && skills.length === 0) return <SkillsGridSkeleton />;
  if (error && skills.length === 0)
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>{t('skills.dashboard.loadFailed')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  if (skills.length === 0)
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Search />
          </EmptyMedia>
          <EmptyTitle>{t('skills.dashboard.noResultsTitle')}</EmptyTitle>
          <EmptyDescription>{t('skills.dashboard.noResultsDescription')}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  return (
    <div className="flex flex-col gap-3">
      {isRefreshing ? (
        <p className="text-muted-foreground text-xs">{t('skills.dashboard.refreshing')}</p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {skills.map((skill) => (
          <CatalogSkillCard key={skill.id} skill={skill} onOpen={onOpen} />
        ))}
      </div>
    </div>
  );
}

function ExploreRails({ onShowMore }: { onShowMore: (viewId: DiscoveryViewId) => void }) {
  const { t } = useTranslation();
  const [searchInput, setSearchInput] = useState('');
  const debouncedQuery = useDebouncedValue(searchInput, 300);
  const isSearching = debouncedQuery.trim().length >= 2;
  const search = useSkillsSearch(debouncedQuery, { enabled: isSearching });
  const hasSearchError = isSearching && Boolean(search.error);
  const [selectedSkill, setSelectedSkill] = useState<SkillsShSkill | null>(null);

  return (
    <div className="relative flex h-full min-w-0 flex-col overflow-hidden">
      <div className="app-material border-border sticky top-0 z-10 flex min-w-0 flex-row flex-wrap items-end justify-between gap-4 border-b p-8 pb-10">
        <div className="flex min-w-0 flex-col items-start gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl leading-none text-balance">{t('skills.dashboard.title')}</h1>
          </div>
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
      <ScrollArea className="min-h-0 min-w-0 flex-1">
        <div className="flex w-full min-w-0 max-w-full flex-col gap-6 px-6 py-4">
          {isSearching ? (
            <SearchResults query={search} onOpen={setSelectedSkill} />
          ) : (
            DISCOVERY_VIEWS.map((view) => (
              <DiscoveryRail
                key={view.id}
                view={view}
                onOpen={setSelectedSkill}
                onShowMore={onShowMore}
              />
            ))
          )}
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

export function SkillsDashboardView() {
  const reduceMotion = useReducedMotion() ?? false;
  const [selectedView, setSelectedView] = useState<DiscoveryViewId | null>(null);
  const [direction, setDirection] = useState<PageSlideDirection>('forward');
  const variants = pageSlideVariants(reduceMotion);

  const openList = (viewId: DiscoveryViewId) => {
    setDirection('forward');
    setSelectedView(viewId);
  };

  const goBack = () => {
    setDirection('back');
    setSelectedView(null);
  };

  return (
    <div className="relative h-full min-w-0 overflow-hidden">
      <AnimatePresence mode="wait" custom={direction} initial={false}>
        {selectedView ? (
          <motion.div
            key={`explore-list-${selectedView}`}
            className="absolute inset-0 min-w-0 overflow-hidden"
            custom={direction}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <DiscoveryListView viewId={selectedView} onBack={goBack} />
          </motion.div>
        ) : (
          <motion.div
            key="explore-rails"
            className="absolute inset-0 min-w-0 overflow-hidden"
            custom={direction}
            variants={variants}
            initial="initial"
            animate="animate"
            exit="exit"
          >
            <ExploreRails onShowMore={openList} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
