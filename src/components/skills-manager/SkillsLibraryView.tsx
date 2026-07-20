import {
  AlertTriangle,
  FolderOpen,
  LoaderCircle,
  MoreHorizontal,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { platform } from '@platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { DESKTOP_APP_DOWNLOAD_URL } from '@/lib/desktop-download';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { useInstalledScanStore } from '@/store/installed-scan-store';
import { useInstalledSkillsUiStore } from '@/store/installed-skills-ui-store';
import { isPermissionError } from './library-errors';
import {
  ALL_AGENTS_FILTER_ID,
  buildProviderSidebarModel,
  contentWarningsForSelection,
  filterSkillsForSelection,
  providerTagsForSkill,
  symlinkOriginalForSelection,
  uninstallAgentScopeFromFilter,
  warningRevealProviderId,
  type ProviderFilterId,
} from './installed-skills-model';
import type { InstalledScanSnapshot, ScannedSkill, ScanWarning } from '@/platform/types';
import { UNIVERSAL_PROVIDER_ID } from '@/platform/types';
import { panelRowSlideVariants } from '@/lib/animation';

export function SkillsLibraryView() {
  if (!platform.hasLocalLibrary) {
    return <LibraryUnavailableStub />;
  }

  return <LocalInstalledSkillsView />;
}

function LibraryUnavailableStub() {
  const { t } = useTranslation();

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex max-w-md flex-col items-center gap-3">
        <h1 className="text-2xl font-semibold text-balance">{t('skills.installed.title')}</h1>
        <p className="text-muted-foreground text-sm text-pretty">
          {t('skills.installed.webUnavailable')}
        </p>
        <p className="text-muted-foreground text-sm text-pretty">
          {t('skills.installed.getAppDescription')}
        </p>
      </div>
      <Button size="lg" onClick={() => void platform.openExternal(DESKTOP_APP_DOWNLOAD_URL)}>
        {t('skills.installed.getApp')}
      </Button>
    </div>
  );
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

  const showPermissionCard = error !== null && isPermissionError(error);
  const sections = snapshot
    ? filterSkillsForSelection(snapshot, providerFilter, showAllUniversal)
    : null;
  const warnings = snapshot ? contentWarningsForSelection(snapshot, providerFilter) : [];
  const pathInfo = snapshot ? resolveSelectedPath(snapshot, providerFilter) : null;
  const showUniversalToggle =
    providerFilter !== ALL_AGENTS_FILTER_ID && providerFilter !== UNIVERSAL_PROVIDER_ID;

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex flex-col gap-4 border-b p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-balance">{t('skills.installed.title')}</h1>
          {sections ? (
            <Badge variant="secondary" className="tabular-nums">
              {sections.primary.length + (sections.universalSection?.length ?? 0)}
            </Badge>
          ) : null}
          {refreshing ? (
            <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
              <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
              {t('skills.installed.refreshing')}
            </span>
          ) : null}
          <Button
            variant="outline"
            size="sm"
            className="ms-auto"
            onClick={() => void rescan()}
            disabled={refreshing && snapshot === null}
          >
            {t('skills.installed.rescan')}
          </Button>
        </div>

        {pathInfo ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground inline-flex max-w-full items-center gap-1.5 text-sm disabled:pointer-events-none disabled:opacity-60"
              onClick={() => {
                void platform.revealProviderSkillsDir(pathInfo.revealId);
              }}
              disabled={Boolean(pathInfo.skillsDir) && !pathInfo.skillsDirExists}
              title={
                pathInfo.skillsDirExists || !pathInfo.skillsDir
                  ? t('skills.installed.revealPath')
                  : t('skills.installed.pathMissing')
              }
            >
              <FolderOpen className="size-3.5 shrink-0" aria-hidden />
              <code className="bg-muted truncate rounded px-1.5 py-0.5 text-xs">
                {pathInfo.skillsDir || t('skills.installed.pathUnknown')}
              </code>
            </button>
          </div>
        ) : null}

        {showUniversalToggle ? (
          <div className="flex items-center gap-2">
            <Switch
              id="show-all-universal"
              checked={showAllUniversal}
              onCheckedChange={setShowAllUniversal}
            />
            <Label htmlFor="show-all-universal" className="text-sm font-normal">
              {t('skills.installed.showAllUniversal')}
            </Label>
          </div>
        ) : null}
      </div>

      <div className="relative min-h-0 flex-1">
        {showPermissionCard ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 p-6">
            <Card className="w-full max-w-md shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="size-4" />
                  {t('skills.installed.permissionTitle')}
                </CardTitle>
                <CardDescription className="text-pretty">
                  {t('skills.installed.permissionBody')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs text-pretty whitespace-pre-wrap">
                  {error}
                </pre>
              </CardContent>
              <CardFooter>
                <Button variant="outline" onClick={() => void rescan()} disabled={refreshing}>
                  {t('skills.installed.tryAgain')}
                </Button>
              </CardFooter>
            </Card>
          </div>
        ) : null}

        <ScrollArea className="h-full">
          <div className="space-y-6 p-6">
            {error && !showPermissionCard ? (
              <Card className="border-destructive/40">
                <CardHeader>
                  <CardTitle className="text-destructive text-base">
                    {t('skills.installed.scanFailedTitle')}
                  </CardTitle>
                  <CardDescription className="text-pretty">
                    {t('skills.installed.scanFailedBody')}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs whitespace-pre-wrap">
                    {error}
                  </pre>
                </CardContent>
              </Card>
            ) : null}

            {warnings.length > 0 ? (
              <div className="space-y-2">
                {warnings.map((warning) => (
                  <ScanWarningBanner key={warningKey(warning)} warning={warning} />
                ))}
              </div>
            ) : null}

            {snapshot === null && refreshing ? (
              <p className="text-muted-foreground text-sm text-pretty">
                {t('skills.installed.loading')}
              </p>
            ) : null}

            {sections && sections.primary.length === 0 && !sections.universalSection?.length ? (
              <p className="text-muted-foreground text-sm text-pretty">
                {emptyMessage(providerFilter, t)}
              </p>
            ) : null}

            {sections && sections.primary.length > 0 && snapshot ? (
              <SkillCardGrid
                skills={sections.primary}
                snapshot={snapshot}
                providerFilter={providerFilter}
              />
            ) : null}

            {sections?.universalSection && sections.universalSection.length > 0 && snapshot ? (
              <div className="space-y-3">
                <h2 className="text-sm font-semibold">{t('skills.installed.universalSection')}</h2>
                <SkillCardGrid
                  skills={sections.universalSection}
                  snapshot={snapshot}
                  providerFilter={providerFilter}
                />
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function SkillCardGrid({
  skills,
  snapshot,
  providerFilter,
}: {
  skills: ScannedSkill[];
  snapshot: InstalledScanSnapshot;
  providerFilter: ProviderFilterId;
}) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <div className="grid grid-cols-3 gap-4">
      {skills.map((skill) => {
        const originalPath = symlinkOriginalForSelection(skill, snapshot, providerFilter);

        return (
          <Card key={skill.name} className="gap-4 py-4">
            <CardHeader className="px-4">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="truncate text-sm">{skill.name}</CardTitle>
                <SkillCardOverflowMenu
                  skill={skill}
                  providerFilter={providerFilter}
                  reduceMotion={reduceMotion}
                />
              </div>
              <CardDescription className="line-clamp-2 text-pretty">
                {skill.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="px-4">
              <div className="flex flex-wrap gap-1.5">
                {providerTagsForSkill(skill, snapshot).map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
              {originalPath ? (
                <p className="text-muted-foreground mt-2 text-xs text-pretty">
                  Original at {originalPath}
                </p>
              ) : null}
            </CardContent>
            <CardFooter className="text-muted-foreground justify-between border-t px-4 pt-4 text-xs">
              <span>{skill.scope}</span>
              <span>{t('skills.installed.cardInstalled')}</span>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}

function SkillCardOverflowMenu({
  skill,
  providerFilter,
  reduceMotion,
}: {
  skill: ScannedSkill;
  providerFilter: ProviderFilterId;
  reduceMotion: boolean;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);
  const copiesCommand = platform.copiesInstallCommand;
  const rescan = useInstalledScanStore((state) => state.rescan);
  const rowVariants = panelRowSlideVariants(Boolean(reduceMotion));

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      setConfirming(false);
    }
  };

  const handleUninstall = async () => {
    setUninstalling(true);
    try {
      await platform.uninstall(skill.uninstallName, {
        agentScope: uninstallAgentScopeFromFilter(providerFilter),
        providerIds: skill.providerIds,
      });
      toast.success(
        t(
          copiesCommand ? 'skills.installed.uninstallCopied' : 'skills.installed.uninstallSuccess',
          { name: skill.name },
        ),
      );
      setOpen(false);
      setConfirming(false);
      await rescan();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (isPermissionError(message)) {
        toast.error(t('skills.install.permissionError'), {
          description: message,
        });
      } else {
        toast.error(
          t(
            copiesCommand
              ? 'skills.installed.uninstallCopyFailed'
              : 'skills.installed.uninstallFailed',
            { name: skill.name },
          ),
          { description: message },
        );
      }
    } finally {
      setUninstalling(false);
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="shrink-0"
          aria-label={t('skills.installed.overflowMenu')}
          disabled={uninstalling}
        >
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="flex h-12 relative min-w-56 flex-col py-0.5">
        <AnimatePresence custom={confirming} mode="popLayout" initial={false}>
          {!confirming ? (
            <motion.div
              key="delete"
              custom={confirming}
              variants={rowVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute  inset-1"
            >
              <DropdownMenuItem
                variant="destructive"
                disabled={uninstalling}
                onSelect={(event) => {
                  event.preventDefault();
                  setConfirming(true);
                  setOpen(true);
                }}
              >
                <Trash2 aria-hidden />
                {t('skills.installed.uninstall')}
              </DropdownMenuItem>
            </motion.div>
          ) : (
            <motion.div
              key="confirm"
              custom={confirming}
              variants={rowVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="absolute inset-x-0 flex items-center gap-2"
            >
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="flex-1"
                disabled={uninstalling}
                onClick={() => void handleUninstall()}
              >
                {t('skills.installed.uninstallYes')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={uninstalling}
                onClick={() => setConfirming(false)}
              >
                {t('skills.installed.uninstallCancel')}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function warningKey(warning: ScanWarning): string {
  return `${warning.code}-${warning.providerId ?? ''}-${warning.path ?? ''}`;
}

function ScanWarningBanner({ warning }: { warning: ScanWarning }) {
  const { t } = useTranslation();
  const revealId = warningRevealProviderId(warning);

  return (
    <div className="bg-amber-500/10 text-amber-950 dark:text-amber-100 flex items-start justify-between gap-3 rounded-md px-3 py-2 text-sm">
      <div className="flex min-w-0 items-start gap-2">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p className="text-pretty">{warning.message}</p>
      </div>
      {revealId ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 border-amber-600/30 bg-background/80 hover:bg-background"
          onClick={() => void platform.revealProviderSkillsDir(revealId)}
        >
          <FolderOpen className="size-3.5" aria-hidden />
          {t('skills.installed.openFolder')}
        </Button>
      ) : null}
    </div>
  );
}

function resolveSelectedPath(
  snapshot: InstalledScanSnapshot,
  selection: ProviderFilterId,
): {
  skillsDir: string | null;
  skillsDirExists: boolean;
  revealId: string;
} | null {
  if (selection === ALL_AGENTS_FILTER_ID) {
    return null;
  }
  if (selection === UNIVERSAL_PROVIDER_ID) {
    return {
      skillsDir: snapshot.universal.skillsDir,
      skillsDirExists: snapshot.universal.skillsDirExists,
      revealId: UNIVERSAL_PROVIDER_ID,
    };
  }
  const model = buildProviderSidebarModel(snapshot);
  const item =
    model.activeProviders.find((p) => p.id === selection) ??
    model.inactiveProviders.find((p) => p.id === selection);
  if (!item) {
    return { skillsDir: null, skillsDirExists: false, revealId: selection };
  }
  return {
    skillsDir: item.skillsDir,
    skillsDirExists: item.skillsDirExists,
    revealId: selection,
  };
}

function emptyMessage(selection: ProviderFilterId, t: (key: string) => string): string {
  if (selection === ALL_AGENTS_FILTER_ID) {
    return t('skills.installed.emptyAll');
  }
  if (selection === UNIVERSAL_PROVIDER_ID) {
    return t('skills.installed.emptyUniversal');
  }
  return t('skills.installed.emptyProvider');
}
