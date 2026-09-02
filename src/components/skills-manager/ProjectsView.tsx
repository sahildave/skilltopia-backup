import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ContinuousTabs } from '@/components/ui/continuous-tabs';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useInstalledScanStore } from '@/store/installed-scan-store';
import { useInstalledSkillsUiStore } from '@/store/installed-skills-ui-store';
import { useProjectsStore } from '@/store/projects-store';
import { platform } from '@platform';
import { FolderOpen, Search } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InstalledToolbar } from './InstalledToolbar';
import { InstalledUnavailableStub } from './InstalledUnavailableStub';
import { SkillCardOverflowMenu } from './SkillCardOverflowMenu';
import { SkillSurfaceCard } from './SkillSurfaceCard';
import { SkillSurfaceListRow } from './SkillSurfaceListRow';
import { ALL_AGENTS_FILTER_ID } from './installed-skills-model';
import {
  filterProjectSkillRows,
  projectSkillRows,
  type ProjectSkillOrigin,
  type ProjectSkillScope,
} from './project-skills-model';
import { SKILL_CHIP_TEXT_CLASS } from './skill-chip';

const PROJECT_SKILL_SCOPES: ProjectSkillScope[] = ['all', 'universal', 'project'];

function isProjectSkillScope(id: string): id is ProjectSkillScope {
  return (PROJECT_SKILL_SCOPES as string[]).includes(id);
}

export function ProjectsView() {
  if (!platform.hasLocalLibrary) {
    return (
      <InstalledUnavailableStub
        titleKey="skills.projects.title"
        unavailableKey="skills.projects.webUnavailable"
        descriptionKey="skills.projects.getAppDescription"
        actionKey="skills.projects.getApp"
      />
    );
  }

  return <LocalProjectsView />;
}

/** Says where a skill lives, so a merged list stays readable. */
function OriginBadge({ origin }: { origin: ProjectSkillOrigin }) {
  const { t } = useTranslation();
  const labelKey =
    origin === 'project'
      ? 'skills.projects.agentsBadge'
      : origin === 'both'
        ? 'skills.projects.bothBadge'
        : 'skills.projects.universalBadge';

  return (
    <Badge variant="secondary" size="sm" className={SKILL_CHIP_TEXT_CLASS}>
      {t(labelKey)}
    </Badge>
  );
}

function LocalProjectsView() {
  const { t } = useTranslation();
  const root = useProjectsStore((state) => state.root);
  const snapshot = useProjectsStore((state) => state.snapshot);
  const hasLoadedProjects = useProjectsStore((state) => state.hasLoadedProjects);
  const refreshing = useProjectsStore((state) => state.refreshing);
  const error = useProjectsStore((state) => state.error);
  const chooseRoot = useProjectsStore((state) => state.chooseRoot);
  const refresh = useProjectsStore((state) => state.refresh);
  const projects = useProjectsStore((state) => state.projects);
  const selectedPath = useProjectsStore((state) => state.selectedPath);
  const selectedProject = projects.find((project) => project.path === selectedPath) ?? null;
  // Globally installed skills reach every project, so the project scan alone
  // under-reports what an agent can invoke here.
  const globalSnapshot = useInstalledScanStore((state) => state.snapshot);
  const layoutMode = useInstalledSkillsUiStore((state) => state.layoutMode);
  const setLayoutMode = useInstalledSkillsUiStore((state) => state.setLayoutMode);
  const scope = useInstalledSkillsUiStore((state) => state.projectSkillScope);
  const setScope = useInstalledSkillsUiStore((state) => state.setProjectSkillScope);
  const [skillQuery, setSkillQuery] = useState('');
  const normalizedSkillQuery = skillQuery.trim().toLocaleLowerCase();
  const rows = projectSkillRows(snapshot, globalSnapshot, scope);
  const visibleRows = filterProjectSkillRows(rows, skillQuery);

  const reduceMotion = useReducedMotion() ?? false;
  function renderChooseFolderButton(variant: 'default' | 'outline' = 'default') {
    return (
      <Button variant={variant} size="default" onClick={() => void chooseRoot()}>
        <FolderOpen data-icon="inline-start" />
        {t('skills.projects.chooseFolder')}
      </Button>
    );
  }

  const scopeTabs = (
    <ContinuousTabs
      value={scope}
      tabs={[
        {
          id: 'all',
          label: t('skills.projects.viewAll'),
          helpTooltip: t('skills.projects.viewHelp.all'),
        },
        {
          id: 'universal',
          label: t('skills.projects.viewUniversal'),
          helpTooltip: t('skills.projects.viewHelp.universal'),
        },
        {
          id: 'project',
          label: t('skills.projects.viewProject'),
          helpTooltip: t('skills.projects.viewHelp.project'),
        },
      ]}
      onChange={(id) => {
        if (isProjectSkillScope(id)) setScope(id);
      }}
    />
  );

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <InstalledToolbar
        title={selectedProject?.name ?? t('skills.projects.title')}
        description={selectedProject?.path ?? root ?? t('skills.projects.noFolder')}
        skillCount={snapshot ? rows.length : null}
        refreshing={refreshing}
        hasSnapshot={snapshot !== null}
        skillQuery={skillQuery}
        layoutMode={layoutMode}
        leadingAction={
          <>
            {scopeTabs}
            {renderChooseFolderButton('outline')}
          </>
        }
        onRescan={root ? () => void refresh() : undefined}
        rescanLabel={t('skills.projects.refresh')}
        showInstalledControls={false}
        onLayoutModeChange={setLayoutMode}
        onSkillQueryChange={setSkillQuery}
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex min-w-0 flex-col gap-4 p-8">
          {error ? (
            <Alert variant="destructive">
              <AlertTitle>{t('skills.projects.loadFailed')}</AlertTitle>
              <AlertDescription>{t('skills.projects.loadFailedDescription')}</AlertDescription>
            </Alert>
          ) : null}
          {root &&
          hasLoadedProjects &&
          !snapshot &&
          !refreshing &&
          projects.length === 0 &&
          !error ? (
            <Empty className="border border-dashed bg-card py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Search />
                </EmptyMedia>
                <EmptyTitle>{t('skills.projects.empty')}</EmptyTitle>
                <EmptyDescription>{t('skills.projects.chooseDescription')}</EmptyDescription>
              </EmptyHeader>
              <EmptyContent>{renderChooseFolderButton()}</EmptyContent>
            </Empty>
          ) : !root || !snapshot ? (
            <Card>
              <CardHeader>
                <CardTitle>{t('skills.projects.chooseTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground flex flex-col items-center gap-4 py-12 text-center text-sm">
                <Search className="size-8" />
                <p>{t('skills.projects.chooseDescription')}</p>
                {renderChooseFolderButton()}
              </CardContent>
            </Card>
          ) : (
            <section className="min-w-0">
              {visibleRows.length === 0 ? (
                <Card>
                  <CardContent className="text-muted-foreground flex flex-col items-center gap-4 py-12 text-center text-sm">
                    <Search className="size-8" />
                    <p>
                      {normalizedSkillQuery
                        ? t('skills.installed.noMatchingSkills')
                        : scope === 'project'
                          ? t('skills.projects.noSkills', {
                              project: selectedProject?.name ?? '',
                            })
                          : t('skills.projects.noSkillsAll')}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex flex-col gap-3">
                  <div
                    data-layout={layoutMode}
                    className={cn(
                      layoutMode === 'grid' ? 'grid grid-cols-3 gap-4' : 'flex flex-col gap-3',
                    )}
                  >
                    {visibleRows.map((row) => {
                      const { skill } = row;
                      const title = (
                        <div className="truncate text-balance line-clamp-1 font-semibold leading-normal">
                          {skill.name}
                        </div>
                      );
                      const subtitle = (
                        <div className="text-muted-foreground line-clamp-2 text-sm text-pretty">
                          {skill.description}
                        </div>
                      );
                      const overflowMenu = (
                        <SkillCardOverflowMenu
                          skill={skill}
                          snapshot={row.snapshot}
                          providerFilter={ALL_AGENTS_FILTER_ID}
                          reduceMotion={reduceMotion}
                        />
                      );
                      // Only the merged list mixes origins; the scoped tabs say
                      // it in their own label already.
                      const originBadge = <OriginBadge origin={row.origin} />;

                      return layoutMode === 'grid' ? (
                        <SkillSurfaceCard
                          key={`${row.origin}-${skill.name}`}
                          title={title}
                          subtitle={subtitle}
                          footerLeading={scope === 'all' ? originBadge : <span />}
                          footerTrailing={overflowMenu}
                        />
                      ) : (
                        <SkillSurfaceListRow
                          key={`${row.origin}-${skill.name}`}
                          title={title}
                          subtitle={subtitle}
                          trailing={
                            <>
                              {scope === 'all' ? originBadge : null}
                              {overflowMenu}
                            </>
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
