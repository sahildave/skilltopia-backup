import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { logger } from '@/lib/logger';
import { cn } from '@/lib/utils';
import type { ProjectInfo } from '@/platform/types';
import { useInstalledSkillsUiStore } from '@/store/installed-skills-ui-store';
import { useProjectsStore } from '@/store/projects-store';
import { platform } from '@platform';
import { ChevronDown, FolderOpen, Search } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { InstalledToolbar } from './InstalledToolbar';
import { InstalledUnavailableStub } from './InstalledUnavailableStub';
import { SkillCardOverflowMenu } from './SkillCardOverflowMenu';
import { SkillProviderBadges } from './SkillProviderBadges';
import { SkillSurfaceCard } from './SkillSurfaceCard';
import { SkillSurfaceListRow } from './SkillSurfaceListRow';
import { ALL_AGENTS_FILTER_ID } from './installed-skills-model';

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

function sortByCountThenName(a: ProjectInfo, b: ProjectInfo): number {
  return b.skillCount - a.skillCount || a.name.localeCompare(b.name);
}

function LocalProjectsView() {
  const { t } = useTranslation();
  const root = useProjectsStore((state) => state.root);
  const projects = useProjectsStore((state) => state.projects);
  logger.debug('LocalProjectsView ~ projects', { projects });

  const selectedPath = useProjectsStore((state) => state.selectedPath);
  const snapshot = useProjectsStore((state) => state.snapshot);
  const refreshing = useProjectsStore((state) => state.refreshing);
  const error = useProjectsStore((state) => state.error);
  const chooseRoot = useProjectsStore((state) => state.chooseRoot);
  const refresh = useProjectsStore((state) => state.refresh);
  const selectProject = useProjectsStore((state) => state.selectProject);
  const layoutMode = useInstalledSkillsUiStore((state) => state.layoutMode);
  const setLayoutMode = useInstalledSkillsUiStore((state) => state.setLayoutMode);
  const [skillQuery, setSkillQuery] = useState('');
  const [otherOpen, setOtherOpen] = useState(false);
  const normalizedSkillQuery = skillQuery.trim().toLocaleLowerCase();
  const visibleSkills = snapshot?.skills.filter((skill) => {
    if (!normalizedSkillQuery) return true;
    return [skill.name, skill.description, ...skill.providerIds].some((value) =>
      value.toLocaleLowerCase().includes(normalizedSkillQuery),
    );
  });

  const reduceMotion = useReducedMotion() ?? false;

  const activeProjects = projects
    .filter((project) => project.skillCount > 0)
    .sort(sortByCountThenName);
  const otherProjects = projects
    .filter((project) => project.skillCount === 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <InstalledToolbar
        title={t('skills.projects.title')}
        description={root ?? t('skills.projects.noFolder')}
        skillCount={snapshot?.skills.length ?? null}
        refreshing={refreshing}
        hasSnapshot={snapshot !== null}
        skillQuery={skillQuery}
        layoutMode={layoutMode}
        leadingAction={
          <Button variant="outline" size="sm" onClick={() => void chooseRoot()}>
            <FolderOpen data-icon="inline-start" />
            {t('skills.projects.chooseFolder')}
          </Button>
        }
        onRescan={root ? () => void refresh() : undefined}
        rescanLabel={t('skills.projects.refresh')}
        showInstalledControls={false}
        onLayoutModeChange={setLayoutMode}
        onSkillQueryChange={setSkillQuery}
      />
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid min-w-0 gap-6 p-8 lg:grid-cols-[240px_minmax(0,1fr)]">
          {!root ? (
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{t('skills.projects.chooseTitle')}</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground flex flex-col items-center gap-4 py-12 text-center text-sm">
                <Search className="size-8" />
                <p>{t('skills.projects.chooseDescription')}</p>
                <Button onClick={() => void chooseRoot()}>
                  {t('skills.projects.chooseFolder')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-col gap-1">
                {activeProjects.map((project) => (
                  <ProjectSidebarRow
                    key={project.path}
                    project={project}
                    showSelected={selectedPath === project.path}
                    onSelect={selectProject}
                  />
                ))}

                {otherProjects.length > 0 ? (
                  <div className="mt-1">
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 border-t border-border py-1 pt-3 pl-1 pr-2"
                      onClick={() => setOtherOpen((open) => !open)}
                      aria-expanded={otherOpen}
                    >
                      <ChevronDown
                        className={cn(
                          'size-3.5 shrink-0 transition-transform',
                          !otherOpen && '-rotate-90',
                        )}
                      />
                      <span className="truncate text-xs font-medium uppercase">
                        {t('skills.projects.otherProjects')}
                      </span>
                      <span className="bg-muted ms-auto rounded-md px-1.5 py-0.5 text-xs tabular-nums">
                        {otherProjects.length}
                      </span>
                    </button>

                    {otherOpen ? (
                      <div className="mt-1 space-y-1 pl-2">
                        {otherProjects.map((project) => (
                          <ProjectSidebarRow
                            key={project.path}
                            project={project}
                            showSelected={selectedPath === project.path}
                            onSelect={selectProject}
                            compact
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {projects.length === 0 ? (
                  <p className="text-muted-foreground px-3 py-2 text-sm">
                    {t('skills.projects.empty')}
                  </p>
                ) : null}
              </div>
              <section className="min-w-0">
                {error ? (
                  <Alert variant="destructive">
                    <AlertTitle>{t('skills.projects.loadFailed')}</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                ) : null}
                {snapshot ? (
                  <div className="flex flex-col gap-3">
                    <div
                      data-layout={layoutMode}
                      className={cn(
                        layoutMode === 'grid' ? 'grid grid-cols-3 gap-4' : 'flex flex-col gap-3',
                      )}
                    >
                      {visibleSkills?.map((skill) => {
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
                        const providerBadges = (
                          <SkillProviderBadges skill={skill} snapshot={snapshot} />
                        );

                        return layoutMode === 'grid' ? (
                          <SkillSurfaceCard
                            key={skill.name}
                            title={title}
                            subtitle={subtitle}
                            footerLeading={providerBadges}
                          />
                        ) : (
                          <SkillSurfaceListRow
                            key={skill.name}
                            title={title}
                            subtitle={subtitle}
                            trailing={
                              <>
                                {providerBadges}
                                <SkillCardOverflowMenu
                                  skill={skill}
                                  snapshot={snapshot}
                                  providerFilter={ALL_AGENTS_FILTER_ID}
                                  reduceMotion={reduceMotion}
                                />
                              </>
                            }
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </section>
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function ProjectSidebarRow({
  project,
  showSelected,
  onSelect,
  compact = false,
}: {
  project: ProjectInfo;
  showSelected: boolean;
  onSelect: (project: ProjectInfo) => Promise<void>;
  compact?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'relative flex w-full items-center gap-1 rounded-md px-2 text-sm transition-colors',
        compact ? 'py-1.5' : 'py-2',
        showSelected
          ? 'bg-muted/70 text-foreground font-medium shadow-xs'
          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
      )}
    >
      {showSelected ? (
        <span aria-hidden className="bg-primary absolute inset-y-1 inset-s-0 w-0.5 rounded-full" />
      ) : null}
      <button
        type="button"
        onClick={() => void onSelect(project)}
        className="flex min-w-0 flex-1 items-center gap-2 text-start"
      >
        <span className="truncate">{project.name}</span>
      </button>

      {showSelected ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-6 shrink-0"
          aria-label={t('skills.installed.openFolder')}
          title={t('skills.installed.openFolder')}
          onClick={() => {
            void platform.revealPath(project.path);
          }}
        >
          <FolderOpen aria-hidden />
        </Button>
      ) : null}

      <span className="bg-muted shrink-0 rounded-md px-1.5 py-0.5 text-xs tabular-nums">
        {project.skillCount}
      </span>
    </div>
  );
}
