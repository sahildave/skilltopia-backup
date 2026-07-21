import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ContinuousTabs } from '@/components/ui/continuous-tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { LibraryLayoutMode } from '@/store/installed-skills-ui-store';
import { platform } from '@platform';
import { ArrowLeft, FolderOpen, LayoutGrid, LayoutList, LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { DitherGradient } from '../dither-kit';

export function LibraryToolbar({
  title,
  description,
  skillCount,
  refreshing = false,
  hasSnapshot = false,
  pathInfo = null,
  showUniversalToggle = false,
  showAllUniversal = false,
  layoutMode,
  onBack,
  onRescan,
  onShowAllUniversalChange,
  onLayoutModeChange,
}: {
  title: string;
  skillCount: number | null;
  refreshing?: boolean;
  hasSnapshot?: boolean;
  pathInfo?: {
    skillsDir: string | null;
    skillsDirExists: boolean;
    revealId: string;
  } | null;
  showUniversalToggle?: boolean;
  showAllUniversal?: boolean;
  layoutMode: LibraryLayoutMode;
  onBack?: () => void;
  onRescan?: () => void;
  onShowAllUniversalChange?: (value: boolean) => void;
  onLayoutModeChange: (mode: LibraryLayoutMode) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="app-material border-border relative sticky top-0 z-10 flex min-w-0 flex-col border-b bg-background gap-4">
      <DitherGradient from="grey" />
      <div className="relative flex min-w-0 flex-row flex-wrap items-center justify-between gap-4 p-8 pb-0 pt-16">
        <div className="flex flex-row items-center gap-3">
          {onBack ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              aria-label={t('skills.dashboard.back')}
            >
              <ArrowLeft data-icon="inline-start" />
              {t('skills.dashboard.back')}
            </Button>
          ) : null}
          {/* title description */}
          <div className="flex min-w-0 flex-col items-start gap-2.5">
            <div className="flex min-w-0 flex-row items-start gap-2.5">
              <h1 className="text-3xl leading-none text-balance">{title}</h1>
              {skillCount !== null ? (
                <Badge variant="secondary" className="tabular-nums">
                  {skillCount}
                </Badge>
              ) : null}
              {refreshing ? (
                <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                  {t('skills.installed.refreshing')}
                </span>
              ) : null}
            </div>
            <p className="text-muted-foreground max-w-2xl text-sm text-pretty">{description}</p>
          </div>
        </div>
      </div>
      {/* tabs section */}
      <div className="relative flex min-w-0 flex-wrap items-center gap-3 px-8 pt-0 pb-4">
        <div className="flex flex-row items-center justify-between w-full gap-2">
          {onRescan ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onRescan}
              disabled={refreshing && !hasSnapshot}
            >
              {t('skills.installed.rescan')}
            </Button>
          ) : null}
          <ContinuousTabs
            value={layoutMode}
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
                onLayoutModeChange(id);
              }
            }}
          />
        </div>
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

      {showUniversalToggle && onShowAllUniversalChange ? (
        <div className="flex items-center gap-2">
          <Switch
            id="show-all-universal"
            checked={showAllUniversal}
            onCheckedChange={onShowAllUniversalChange}
          />
          <Label htmlFor="show-all-universal" className="text-sm font-normal">
            {t('skills.installed.showAllUniversal')}
          </Label>
        </div>
      ) : null}
    </div>
  );
}
