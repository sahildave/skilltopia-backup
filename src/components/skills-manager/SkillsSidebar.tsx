import appLogo from '@/assets/icon.png';
import { Button } from '@/components/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Separator } from '@/components/ui/separator';
import { useTheme } from '@/hooks/use-theme';
import { CODUO_URL, GITHUB_REPO_URL } from '@/lib/desktop-download';
import { cn } from '@/lib/utils';
import { useInstalledScanStore } from '@/store/installed-scan-store';
import { useInstalledSkillsUiStore } from '@/store/installed-skills-ui-store';
import { platform } from '@platform';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BookOpen,
  FolderGit2,
  ChevronDown,
  LayoutDashboard,
  Moon,
  Search,
  Sun,
  X,
  type Sparkles,
} from 'lucide-react';
import { useState, type SVGProps } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ALL_AGENTS_FILTER_ID,
  buildProviderSidebarModel,
  sidebarWarnings,
  type ProviderFilterId,
  type ProviderSidebarItem,
} from './installed-skills-model';
import type { SkillsNavId } from './types';


/** Lucide dropped brand icons; keep the GitHub mark as a local SVG. */
function GithubIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  );
}

const PRIMARY_NAV: {
  id: SkillsNavId;
  labelKey: string;
  icon: LucideIcon;
}[] = [
  { id: 'explore', labelKey: 'skills.nav.explore', icon: LayoutDashboard },
  { id: 'installed', labelKey: 'skills.nav.installed', icon: BookOpen },
  { id: 'projects', labelKey: 'skills.nav.projects', icon: FolderGit2 },
];

interface SkillsSidebarProps {
  active: SkillsNavId;
  onSelect: (id: SkillsNavId) => void;
}

export function SkillsSidebar({ active, onSelect }: SkillsSidebarProps) {
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const snapshot = useInstalledScanStore((state) => state.snapshot);
  const providerFilter = useInstalledSkillsUiStore((state) => state.providerFilter);
  const setProviderFilter = useInstalledSkillsUiStore((state) => state.setProviderFilter);
  const [inactiveOpen, setInactiveOpen] = useState(false);
  const [providerQuery, setProviderQuery] = useState('');

  const model = platform.hasLocalLibrary && snapshot ? buildProviderSidebarModel(snapshot) : null;

  const query = providerQuery.trim().toLowerCase();
  const matchesQuery = (name: string) => !query || name.toLowerCase().includes(query);

  const universalLabel = t('skills.installed.universal');
  const showUniversal = model ? matchesQuery(universalLabel) : false;
  const filteredActiveProviders =
    model?.activeProviders.filter((item) => matchesQuery(item.name)) ?? [];
  const filteredInactiveProviders =
    model?.inactiveProviders.filter((item) => matchesQuery(item.name)) ?? [];
  const hasProviderMatches =
    showUniversal || filteredActiveProviders.length > 0 || filteredInactiveProviders.length > 0;
  const inactiveExpanded = inactiveOpen || query.length > 0;

  const handleThemeChange = (value: 'light' | 'dark' | 'system') => {
    setTheme(value);
  };
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  return (
    <div className="flex h-full flex-col bg-muted/40">
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="size-11 overflow-hidden rounded-lg border bg-background">
          <img src={appLogo} alt="" className="size-full object-cover" aria-hidden="true" />
        </div>
      </div>

      <nav
        className="flex flex-1 flex-col gap-1 overflow-hidden px-2"
        aria-label={t('skills.sidebar.primaryNav')}
      >
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                if (item.id === 'installed') {
                  setProviderFilter(ALL_AGENTS_FILTER_ID);
                }
                onSelect(item.id);
              }}
              className={cn(
                'app-pressable app-pressable-subtle relative flex items-center gap-2 rounded-md px-3 py-2 text-sm',
                isActive
                  ? 'bg-background text-foreground font-medium shadow-md'
                  : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
                'focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]',
              )}
            >
              {isActive ? (
                <span
                  aria-hidden
                  className="bg-primary absolute inset-y-1 inset-s-0 w-0.5 rounded-full"
                />
              ) : null}
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{t(item.labelKey)}</span>
            </button>
          );
        })}

        {model ? (
          <>
            <Separator className="my-3" />
            <div className="min-h-0 flex-1 flex flex-col gap-0 overflow-y-auto pb-2">
              <div className="px-3 py-1">
                <p className="text-muted-foreground text-xs mb-1 font-medium uppercase">
                  {t('skills.installed.providersHeading')}
                </p>
              </div>

              <div className="mb-2">
                <InputGroup className="h-8">
                  <InputGroupAddon>
                    <Search className="size-3.5" />
                  </InputGroupAddon>
                  <InputGroupInput
                    value={providerQuery}
                    onChange={(event) => setProviderQuery(event.target.value)}
                    placeholder={t('skills.installed.searchProviders')}
                    className="text-xs"
                    aria-label={t('skills.installed.searchProviders')}
                    autoComplete="off"
                    spellCheck={false}
                  />
                  {providerQuery ? (
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        size="icon-xs"
                        aria-label={t('skills.installed.clearProviderSearch')}
                        onClick={() => setProviderQuery('')}
                      >
                        <X />
                      </InputGroupButton>
                    </InputGroupAddon>
                  ) : null}
                </InputGroup>
              </div>

              {showUniversal ? (
                <ProviderRow
                  item={{
                    ...model.universal,
                    name: universalLabel,
                  }}
                  selected={providerFilter === model.universal.id}
                  onSelect={setProviderFilter}
                  installedTabActive={active === 'installed'}
                  onEnsureInstalledTab={() => onSelect('installed')}
                />
              ) : null}

              {filteredActiveProviders.map((item) => (
                <ProviderRow
                  key={item.id}
                  item={item}
                  selected={providerFilter === item.id}
                  onSelect={setProviderFilter}
                  installedTabActive={active === 'installed'}
                  onEnsureInstalledTab={() => onSelect('installed')}
                />
              ))}

              {query.length > 0 && !hasProviderMatches ? (
                <p className="text-muted-foreground px-3 py-2 text-xs">
                  {t('skills.installed.noMatchingProviders')}
                </p>
              ) : null}

              {filteredInactiveProviders.length > 0 || !query ? (
                <div className="mt-1">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 pl-1 pr-2 py-1 pt-3 border-t border-border"
                    onClick={() => setInactiveOpen((open) => !open)}
                    aria-expanded={inactiveExpanded}
                  >
                    <ChevronDown
                      className={cn(
                        'size-3.5 shrink-0 transition-transform',
                        !inactiveExpanded && '-rotate-90',
                      )}
                    />
                    <span className="truncate text-xs font-medium uppercase">
                      {t('skills.installed.inactiveProviders')}
                    </span>
                    <span className="bg-muted ms-auto rounded-md px-1.5 py-0.5 text-xs tabular-nums">
                      {query ? filteredInactiveProviders.length : model.inactiveProviders.length}
                    </span>
                  </button>

                  {inactiveExpanded ? (
                    <div className="mt-1 space-y-1 pl-2">
                      {(query ? filteredInactiveProviders : model.inactiveProviders).map((item) => (
                        <ProviderRow
                          key={item.id}
                          item={item}
                          selected={providerFilter === item.id}
                          onSelect={setProviderFilter}
                          installedTabActive={active === 'installed'}
                          onEnsureInstalledTab={() => onSelect('installed')}
                          compact
                        />
                      ))}
                      {query && filteredInactiveProviders.length === 0 ? (
                        <p className="text-muted-foreground px-2 py-2 text-xs">
                          {t('skills.installed.noMatchingProviders')}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </nav>

      <div className="border-t group flex flex-row gap-1 p-2 items-center justify-between">
        <div className="flex flex-row gap-1 items-center">
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            aria-label={t('skills.sidebar.toggleTheme')}
            onClick={() => handleThemeChange(isDark ? 'light' : 'dark')}
          >
            {isDark ? <Sun /> : <Moon />}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="icon-sm"
            aria-label={t('skills.sidebar.openGithub')}
            onClick={() => void platform.openExternal(GITHUB_REPO_URL)}
          >
            <GithubIcon />
          </Button>
        </div>
        <div className="flex flex-col text-[10px] text-muted-foreground text-right items-end gap-0">
          <span>Made by</span>
          <Button
            variant="link"
            size="sm"
            className="px-0 py-0 h-3 text-xs rounded-sm text-muted-foreground group-hover:text-primary"
            onClick={() => void platform.openExternal(CODUO_URL)}
          >
            coduo.co
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProviderRow(props: {
  item?: ProviderSidebarItem;
  id?: ProviderFilterId;
  name?: string;
  skillCount?: number;
  selected: boolean;
  onSelect: (id: ProviderFilterId) => void;
  icon?: typeof Sparkles;
  installedTabActive: boolean;
  onEnsureInstalledTab: () => void;
  compact?: boolean;
}) {
  const {
    item,
    selected,
    onSelect,
    icon: Icon,
    installedTabActive,
    onEnsureInstalledTab,
    compact = false,
  } = props;
  const rowId = item?.id ?? props.id;
  const rowName = item?.name ?? props.name;
  if (rowId === undefined || rowName === undefined) {
    return null;
  }
  const count = item?.skillCount ?? props.skillCount ?? 0;
  const hasWarning = sidebarWarnings(item?.warnings ?? []).length > 0;
  const showSelected = selected && installedTabActive;

  return (
    <button
      type="button"
      onClick={() => {
        onSelect(rowId);
        if (!installedTabActive) onEnsureInstalledTab();
      }}
      className={cn(
        'relative flex w-full items-center gap-2 rounded-md px-2 text-sm transition-colors',
        compact ? 'py-1.5' : 'py-2',
        showSelected
          ? 'bg-background text-foreground font-medium shadow-xs'
          : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
      )}
    >
      {showSelected ? (
        <span aria-hidden className="bg-primary absolute inset-y-1 inset-s-0 w-0.5 rounded-full" />
      ) : null}
      {Icon ? <Icon className="size-4 shrink-0" /> : null}
      <span className="truncate">{rowName}</span>
      {hasWarning ? (
        <AlertTriangle
          className="size-3.5 shrink-0 text-amber-600 dark:text-amber-500"
          aria-hidden
        />
      ) : null}
      <span className="bg-muted ms-auto rounded-md px-1.5 py-0.5 text-xs tabular-nums">
        {count}
      </span>
    </button>
  );
}
