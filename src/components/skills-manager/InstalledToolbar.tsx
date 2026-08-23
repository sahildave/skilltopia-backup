import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ContinuousTabs } from '@/components/ui/continuous-tabs';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { cn } from '@/lib/utils';
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
import { motion, useReducedMotion } from 'motion/react';
import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { DitherGradient } from '../dither-kit';
import type { InstalledSkillView } from './installed-skills-model';

/**
 * One clock for the whole collapse. Every moving part uses it, so nothing can
 * drift out of step with anything else.
 */
const COLLAPSE_DURATION_S = 0.32;
const COLLAPSE_EASE = [0.32, 0.72, 0, 1] as const;
const FADE_CLASS =
  'transition-opacity duration-[320ms] ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none';

/**
 * Natural height of the toolbar content. The wrapper animates its real height
 * from this. The content carries no CSS layout transitions, so this measures
 * the final layout once rather than chasing it frame by frame.
 *
 * Measured in a layout effect keyed on `collapsed`, so the expanded height is
 * read in the same commit as the class change. A ResizeObserver alone reports
 * asynchronously, which would hand the list a stale collapsed height for a
 * frame and flick its top padding.
 */
function useContentHeight(
  ref: RefObject<HTMLDivElement | null>,
  collapsed: boolean,
  onExpandedHeightChange?: (height: number) => void,
): number | undefined {
  const [height, setHeight] = useState<number>();

  useLayoutEffect(() => {
    const content = ref.current;
    if (!content) return;

    const measure = () => {
      const next = content.offsetHeight;
      setHeight(next);
      // The list reserves room for the expanded header, so only report that.
      if (!collapsed) onExpandedHeightChange?.(next);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [ref, collapsed, onExpandedHeightChange]);

  return height;
}

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
  collapsed = false,
  onBack,
  onRescan,
  rescanLabel,
  leadingAction,
  searchError,
  searchPlaceholder,
  searchLabel,
  clearSearchLabel,
  showInstalledControls = true,
  onExpandedHeightChange,
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
  collapsed?: boolean;
  onBack?: () => void;
  onRescan?: () => void;
  rescanLabel?: string;
  leadingAction?: ReactNode;
  searchError?: ReactNode;
  searchPlaceholder?: string;
  searchLabel?: string;
  clearSearchLabel?: string;
  showInstalledControls?: boolean;
  onExpandedHeightChange?: (height: number) => void;
  onLayoutModeChange?: (mode: LibraryLayoutMode) => void;
  onInstalledSkillViewChange?: (view: InstalledSkillView) => void;
  onSkillQueryChange: (value: string) => void;
}) {
  const { t } = useTranslation();
  const contentRef = useRef<HTMLDivElement>(null);
  const contentHeight = useContentHeight(contentRef, collapsed, onExpandedHeightChange);
  const reduceMotion = useReducedMotion() ?? false;
  const transition = reduceMotion
    ? { duration: 0 }
    : { duration: COLLAPSE_DURATION_S, ease: COLLAPSE_EASE };

  return (
    <div className="app-material border-border relative flex min-w-0 flex-col gap-0 border-b bg-background">
      <DitherGradient from="grey" />

      <motion.div
        initial={false}
        animate={{ height: contentHeight ?? 'auto' }}
        transition={transition}
        className="relative overflow-hidden"
      >
        {/*
          One flat row of controls in both states; `order` alone re-sequences
          them, so nothing remounts and the search never loses focus.
          Expanded:  title · search / (break) / tabs · trailing
          Collapsed: title · tabs · search · trailing
        */}
        <div
          ref={contentRef}
          data-collapsed={collapsed}
          className={cn(
            'relative flex min-w-0 flex-wrap items-center gap-x-3 gap-y-4 px-8',
            collapsed ? 'py-3' : 'pt-15 pb-4',
          )}
        >
          {onBack ? (
            <Button
              variant="ghost"
              size="sm"
              className="order-1 shrink-0"
              onClick={onBack}
              aria-label={t('skills.dashboard.back')}
            >
              <ArrowLeft data-icon="inline-start" />
              {t('skills.dashboard.back')}
            </Button>
          ) : null}

          {/* title description */}
          <motion.div
            layout="position"
            transition={transition}
            className={cn(
              'order-1 flex min-w-0 flex-col items-start gap-2.5 px-1',
              collapsed ? 'flex-none' : 'flex-1',
            )}
          >
            <div className="flex h-7.5 min-w-0 flex-row items-center gap-2.5">
              <h1 className="text-3xl leading-none text-balance">{title}</h1>
              {skillCount !== null ? (
                <Badge variant="secondary" size="sm" className="mt-3.5 tabular-nums">
                  {skillCount}
                </Badge>
              ) : null}
              {/* fixed slot so toggling the spinner never shifts the row */}
              <span className="text-muted-foreground flex size-6 shrink-0 items-center justify-center">
                {refreshing ? (
                  <>
                    <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                    <span className="sr-only">{t('skills.installed.refreshing')}</span>
                  </>
                ) : null}
              </span>
            </div>

            {/* leaves the flow at once so the height lands on one target, and fades over it */}
            <div
              aria-hidden={collapsed}
              className={cn(
                'w-full',
                FADE_CLASS,
                collapsed ? 'pointer-events-none absolute opacity-0' : 'opacity-100',
              )}
            >
              <div className="text-muted-foreground flex max-w-2xl flex-row flex-wrap items-center gap-1 text-sm text-pretty">
                Skills within your projects in {description}{' '}
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
          </motion.div>

          <motion.div
            layout="position"
            transition={transition}
            className={cn(
              'h-10',
              collapsed ? 'order-3 min-w-40 flex-1' : 'order-2 w-full max-w-sm shrink-0',
            )}
          >
            <InputGroup className="h-10 rounded-xl bg-background!">
              <InputGroupAddon>
                <Search className="size-3.5" />
              </InputGroupAddon>
              <InputGroupInput
                value={skillQuery}
                onChange={(event) => onSkillQueryChange(event.target.value)}
                placeholder={searchPlaceholder ?? t('skills.installed.searchSkills')}
                aria-label={searchLabel ?? t('skills.installed.searchSkills')}
                autoComplete="off"
                spellCheck={false}
              />
              {skillQuery ? (
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    size="icon-xs"
                    aria-label={clearSearchLabel ?? t('skills.installed.clearSkillSearch')}
                    onClick={() => onSkillQueryChange('')}
                  >
                    <X />
                  </InputGroupButton>
                </InputGroupAddon>
              ) : null}
            </InputGroup>
          </motion.div>
          {searchError ? (
            <div className={cn('w-full basis-full', collapsed ? 'order-3' : 'order-2')}>
              {searchError}
            </div>
          ) : null}

          {/* zero-height full-width item: forces the controls onto their own line when expanded */}
          {collapsed ? null : <div aria-hidden className="order-2 h-0 basis-full" />}

          <motion.div
            layout="position"
            transition={transition}
            className={cn(
              'relative flex min-w-0 flex-wrap items-center',
              collapsed ? 'order-2' : 'order-4 -mt-4',
            )}
          >
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
          </motion.div>

          <motion.div
            layout="position"
            transition={transition}
            className={cn(
              'ms-auto flex items-center gap-2',
              collapsed ? 'order-4' : 'order-5 -mt-4',
            )}
          >
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
                    label: collapsed ? undefined : t('skills.installed.layoutList'),
                    ariaLabel: t('skills.installed.layoutList'),
                    icon: LayoutList,
                  },
                  {
                    id: 'grid',
                    label: collapsed ? undefined : t('skills.installed.layoutGrid'),
                    ariaLabel: t('skills.installed.layoutGrid'),
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
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
