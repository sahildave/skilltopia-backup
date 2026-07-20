import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ContinuousTabs } from '@/components/ui/continuous-tabs';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import type { LibraryLayoutMode } from '@/store/installed-skills-ui-store';
import { FolderOpen, LayoutGrid, LayoutList, LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { platform } from '@platform';

export function LibraryToolbar({
  skillCount,
  refreshing,
  hasSnapshot,
  pathInfo,
  showUniversalToggle,
  showAllUniversal,
  layoutMode,
  onRescan,
  onShowAllUniversalChange,
  onLayoutModeChange,
}: {
  skillCount: number | null;
  refreshing: boolean;
  hasSnapshot: boolean;
  pathInfo: {
    skillsDir: string | null;
    skillsDirExists: boolean;
    revealId: string;
  } | null;
  showUniversalToggle: boolean;
  showAllUniversal: boolean;
  layoutMode: LibraryLayoutMode;
  onRescan: () => void;
  onShowAllUniversalChange: (value: boolean) => void;
  onLayoutModeChange: (mode: LibraryLayoutMode) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-4 border-b p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-row items-baseline gap-1">
          <h1 className="text-2xl font-semibold text-balance">{t('skills.installed.title')}</h1>
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
        <div className="flex flex-row items-center gap-2">
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
          <Button
            variant="outline"
            size="sm"
            onClick={onRescan}
            disabled={refreshing && !hasSnapshot}
          >
            {t('skills.installed.rescan')}
          </Button>
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

      {showUniversalToggle ? (
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
