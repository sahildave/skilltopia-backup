import type { SkillsShSkill } from '@/catalog/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { DISCOVERY_VIEWS, useSkillsLeaderboard } from '@/services/skills-sh';
import { useInstalledSkillsUiStore } from '@/store/installed-skills-ui-store';
import { AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CatalogSkillCard, CatalogSkillListRow } from './CatalogSkillCard';
import { LibraryToolbar } from './LibraryToolbar';
import { SkillDetailDialog } from './SkillDetailDialog';

const LIST_PER_PAGE = 100;

export type DiscoveryViewId = (typeof DISCOVERY_VIEWS)[number]['id'];

function errorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : error ? String(error) : null;
}

function DiscoveryListSkeleton({ layoutMode }: { layoutMode: 'grid' | 'list' }) {
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
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

export function DiscoveryListView({
  viewId,
  onBack,
}: {
  viewId: DiscoveryViewId;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const view = DISCOVERY_VIEWS.find((entry) => entry.id === viewId) ?? DISCOVERY_VIEWS[0];
  const layoutMode = useInstalledSkillsUiStore((state) => state.layoutMode);
  const setLayoutMode = useInstalledSkillsUiStore((state) => state.setLayoutMode);
  const query = useSkillsLeaderboard({ view: viewId, perPage: LIST_PER_PAGE });
  const skills = query.data ?? [];
  const error = errorMessage(query.error);
  const [selectedSkill, setSelectedSkill] = useState<SkillsShSkill | null>(null);

  return (
    <div className="relative flex h-full flex-col">
      <LibraryToolbar
        title={view.label}
        skillCount={skills.length > 0 ? skills.length : null}
        refreshing={query.isFetching && skills.length > 0}
        layoutMode={layoutMode}
        onBack={onBack}
        onLayoutModeChange={setLayoutMode}
      />
      <div className="relative min-h-0 flex-1">
        <ScrollArea className="h-full">
          <div className="flex flex-col gap-6 p-6">
            {error ? (
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>{t('skills.dashboard.loadFailed')}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            {query.isLoading && skills.length === 0 ? (
              <DiscoveryListSkeleton layoutMode={layoutMode} />
            ) : null}
            {skills.length > 0 ? (
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
                    <CatalogSkillCard key={skill.id} skill={skill} onOpen={setSelectedSkill} />
                  ) : (
                    <CatalogSkillListRow key={skill.id} skill={skill} onOpen={setSelectedSkill} />
                  ),
                )}
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </div>
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
