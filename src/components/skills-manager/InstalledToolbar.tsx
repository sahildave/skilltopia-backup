import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ContinuousTabs } from '@/components/ui/continuous-tabs';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import type { LibraryLayoutMode } from '@/store/installed-skills-ui-store';
import { platform } from '@platform';
import {
  ArrowLeft,
  LayoutGrid,
  LayoutList,
  LoaderCircle,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { DitherGradient } from '../dither-kit';
import type { InstalledSkillView } from './installed-skills-model';

export function InstalledToolbar({
  title,
  description,
  skillCount,
  refreshing = false,
  hasSnapshot = false,
  pathInfo = null,
  layoutMode = 'list',
  installedSkillView = 'all',
  skillQuery,
  onBack,
  onRescan,
  rescanLabel,
  leadingAction,
  showInstalledControls = true,
  onLayoutModeChange,
  onInstalledSkillViewChange,
  onSkillQueryChange,
}: {
  title: string;
  description: string;
  skillCount: number | null;
  refreshing?: boolean;
  hasSnapshot?: boolean;
  pathInfo?: {
    skillsDir: string | null;
    skillsDirExists: boolean;
    revealId: string;
  } | null;
  layoutMode?: LibraryLayoutMode;
  installedSkillView?: InstalledSkillView;
  skillQuery: string;
  onBack?: () => void;
  onRescan?: () => void;
  rescanLabel?: string;
  leadingAction?: ReactNode;
  showInstalledControls?: boolean;
  onLayoutModeChange?: (mode: LibraryLayoutMode) => void;
  onInstalledSkillViewChange?: (view: InstalledSkillView) => void;
  onSkillQueryChange: (value: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="app-material border-border relative sticky top-0 z-10 flex min-w-0 flex-col border-b bg-background gap-0">
      <DitherGradient from="grey" />

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
        <div className="relative flex min-w-0 w-full flex-row flex-wrap items-center justify-between gap-4 p-8 pb-3.5 pt-15">
          <div className="flex min-w-0 flex-col px-1 items-start gap-2.5">
            <div className="flex min-w-0 h-7.5 flex-row items-center  gap-2.5">
              <h1 className="text-3xl leading-none text-balance">{title}</h1>
              {skillCount !== null ? (
                <Badge variant="secondary" size="sm" className="mt-3.5 tabular-nums">
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
            <div className="text-muted-foreground flex max-w-2xl flex-row flex-wrap items-center gap-1 text-sm text-pretty">
              {description}{' '}
              {pathInfo ? (
                <div className="flex flex-wrap items-center gap-0">
                  <button
                    type="button"
                    className="hover:text-muted-foreground text-foreground inline-flex max-w-full items-center gap-0.5 text-sm disabled:pointer-events-none disabled:opacity-60"
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
                    <code className="bg-muted truncate rounded px-1 py-0.5 text-xs">
                      {pathInfo.skillsDir || t('skills.installed.pathUnknown')}
                    </code>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
          <InputGroup className="h-10 w-full max-w-sm shrink-0 rounded-xl bg-background!">
            <InputGroupAddon>
              <Search className="size-3.5" />
            </InputGroupAddon>
            <InputGroupInput
              value={skillQuery}
              onChange={(event) => onSkillQueryChange(event.target.value)}
              placeholder={t('skills.installed.searchSkills')}
              aria-label={t('skills.installed.searchSkills')}
              autoComplete="off"
              spellCheck={false}
            />
            {skillQuery ? (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  aria-label={t('skills.installed.clearSkillSearch')}
                  onClick={() => onSkillQueryChange('')}
                >
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            ) : null}
          </InputGroup>
        </div>
      </div>

      {/* tabs section */}
      <div className="relative flex min-w-0 flex-wrap items-center gap-3 px-8 pb-4">
        <div className="flex flex-row flex-wrap items-center justify-between w-full gap-2">
          <div className="flex flex-wrap items-center gap-2">{leadingAction}</div>

          {showInstalledControls ? (
            <ContinuousTabs
              value={installedSkillView}
              tabs={[
                {
                  id: 'all',
                  label: t('skills.installed.viewAll'),
                  helpTooltip: t('skills.installed.viewHelp.all'),
                },
                {
                  id: 'provider',
                  label: t('skills.installed.viewProvider'),
                  helpTooltip: t('skills.installed.viewHelp.provider'),
                },
                {
                  id: 'available',
                  label: t('skills.installed.viewAvailable'),
                  helpTooltip: t('skills.installed.viewHelp.available'),
                },
              ]}
              onChange={(id) => {
                if (id === 'all' || id === 'provider' || id === 'available') {
                  onInstalledSkillViewChange?.(id);
                }
              }}
            />
          ) : null}

          <div className="ms-auto flex items-center gap-2">
            {onRescan ? (
              <Button
                variant="secondary"
                size="icon"
                onClick={onRescan}
                disabled={refreshing && !hasSnapshot}
                aria-label={rescanLabel ?? t('skills.installed.rescan')}
                title={rescanLabel ?? t('skills.installed.rescan')}
              >
                <RefreshCw aria-hidden />
              </Button>
            ) : null}

            {onLayoutModeChange ? (
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
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
