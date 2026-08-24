import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
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

function LocalProjectsView() {
  const { t } = useTranslation();
  const root = useProjectsStore((state) => state.root);
  const snapshot = useProjectsStore((state) => state.snapshot);
  const refreshing = useProjectsStore((state) => state.refreshing);
  const error = useProjectsStore((state) => state.error);
  const chooseRoot = useProjectsStore((state) => state.chooseRoot);
  const refresh = useProjectsStore((state) => state.refresh);
  const projects = useProjectsStore((state) => state.projects);
  const selectedPath = useProjectsStore((state) => state.selectedPath);
  const selectedProject = projects.find((project) => project.path === selectedPath) ?? null;
  const layoutMode = useInstalledSkillsUiStore((state) => state.layoutMode);
  const setLayoutMode = useInstalledSkillsUiStore((state) => state.setLayoutMode);
  const [skillQuery, setSkillQuery] = useState('');
  const normalizedSkillQuery = skillQuery.trim().toLocaleLowerCase();
  const visibleSkills = snapshot?.skills.filter((skill) => {
    if (!normalizedSkillQuery) return true;
    return [skill.name, skill.description, ...skill.providerIds].some((value) =>
      value.toLocaleLowerCase().includes(normalizedSkillQuery),
    );
  });

  const reduceMotion = useReducedMotion() ?? false;

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <InstalledToolbar
        title={t('skills.projects.title')}
        description={selectedProject?.path ?? root ?? t('skills.projects.noFolder')}
        skillCount={snapshot?.skills.length ?? null}
        refreshing={refreshing}
        hasSnapshot={snapshot !== null}
        skillQuery={skillQuery}
        layoutMode={layoutMode}
        leadingAction={
          <Button variant="outline" size="default" onClick={() => void chooseRoot()}>
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
        <div className="min-w-0 p-8">
          {!root || !snapshot ? (
            <Card>
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
            <section className="min-w-0">
              {error ? (
                <Alert variant="destructive">
                  <AlertTitle>{t('skills.projects.loadFailed')}</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              ) : null}
              {snapshot && visibleSkills?.length === 0 ? (
                <Card>
                  <CardContent className="text-muted-foreground flex flex-col items-center gap-4 py-12 text-center text-sm">
                    <Search className="size-8" />
                    <p>
                      {normalizedSkillQuery
                        ? t('skills.installed.noMatchingSkills')
                        : t('skills.projects.noSkills', {
                            project: selectedProject?.name ?? '',
                          })}
                    </p>
                  </CardContent>
                </Card>
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

                      return layoutMode === 'grid' ? (
                        <SkillSurfaceCard
                          key={skill.name}
                          title={title}
                          subtitle={subtitle}
                          footerLeading={<span></span>}
                          footerTrailing={
                            <SkillCardOverflowMenu
                              skill={skill}
                              snapshot={snapshot}
                              providerFilter={ALL_AGENTS_FILTER_ID}
                              reduceMotion={reduceMotion}
                            />
                          }
                        />
                      ) : (
                        <SkillSurfaceListRow
                          key={skill.name}
                          title={title}
                          subtitle={subtitle}
                          trailing={
                            <SkillCardOverflowMenu
                              skill={skill}
                              snapshot={snapshot}
                              providerFilter={ALL_AGENTS_FILTER_ID}
                              reduceMotion={reduceMotion}
                            />
                          }
                        />
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </section>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
