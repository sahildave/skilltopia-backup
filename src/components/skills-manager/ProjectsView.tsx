import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import { getSeedForView } from '@/data/skills-seed';
import { useProjectsStore } from '@/store/projects-store';
import { platform } from '@platform';
import {
  catalogSourceForScannedSkill,
  catalogSourcesByInstalledKey,
} from './catalog-installed-match';
import { InstalledUnavailableStub } from './InstalledUnavailableStub';
import { FolderOpen, RefreshCw, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
  const projects = useProjectsStore((state) => state.projects);
  const selectedPath = useProjectsStore((state) => state.selectedPath);
  const snapshot = useProjectsStore((state) => state.snapshot);
  const refreshing = useProjectsStore((state) => state.refreshing);
  const error = useProjectsStore((state) => state.error);
  const chooseRoot = useProjectsStore((state) => state.chooseRoot);
  const refresh = useProjectsStore((state) => state.refresh);
  const selectProject = useProjectsStore((state) => state.selectProject);
  const catalogSources = catalogSourcesByInstalledKey(getSeedForView('all-time'));

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden">
      <header className="border-border flex items-start justify-between gap-4 border-b bg-background p-8 pb-5 pt-16">
        <div className="min-w-0">
          <h1 className="text-3xl leading-none">{t('skills.projects.title')}</h1>
          <p className="text-muted-foreground mt-2 truncate text-sm">
            {root ?? t('skills.projects.noFolder')}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" onClick={() => void chooseRoot()}>
            <FolderOpen />
            {t('skills.projects.chooseFolder')}
          </Button>
          {root ? (
            <Button
              variant="outline"
              size="icon"
              onClick={() => void refresh()}
              aria-label={t('skills.projects.refresh')}
            >
              {refreshing ? <Spinner /> : <RefreshCw />}
            </Button>
          ) : null}
        </div>
      </header>
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
                {projects.map((project) => (
                  <button
                    key={project.path}
                    type="button"
                    onClick={() => void selectProject(project)}
                    className={cn(
                      'rounded-lg px-3 py-2 text-start text-sm',
                      selectedPath === project.path
                        ? 'bg-accent text-foreground'
                        : 'text-muted-foreground hover:bg-muted',
                    )}
                  >
                    <span className="block truncate font-medium">{project.name}</span>
                    <span className="text-muted-foreground block truncate text-xs">
                      {project.depth === 2
                        ? t('skills.projects.nested')
                        : t('skills.projects.direct')}
                    </span>
                  </button>
                ))}
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
                    <div>
                      <h2 className="text-xl font-medium">{t('skills.projects.skillsTitle')}</h2>
                      <p className="text-muted-foreground text-sm">
                        {snapshot.skills.length} {t('skills.projects.skillsFound')}
                      </p>
                    </div>
                    {snapshot.skills.map((skill) =>
                      (() => {
                        const source = catalogSourceForScannedSkill(skill, catalogSources);
                        return (
                          <Card key={skill.name}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                  <h3 className="truncate font-medium">{skill.name}</h3>
                                  <p className="text-muted-foreground mt-1 text-sm">
                                    {skill.description}
                                  </p>
                                </div>
                                <span className="text-muted-foreground shrink-0 text-xs">
                                  {source
                                    ? `${t('skills.projects.catalogMatch')} · ${source}`
                                    : skill.providerIds.join(', ')}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })(),
                    )}
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
