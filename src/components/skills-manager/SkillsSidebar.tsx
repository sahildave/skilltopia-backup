import appLogo from '@/assets/logo.png';
import { Button } from '@/components/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { Separator } from '@/components/ui/separator';
import { useCommandContext } from '@/hooks/use-command-context';
import { executeCommand } from '@/lib/commands/registry';
import { cn } from '@/lib/utils';
import { useInstalledScanStore } from '@/store/installed-scan-store';
import { useInstalledSkillsUiStore } from '@/store/installed-skills-ui-store';
import { platform } from '@platform';
import type { LucideIcon } from 'lucide-react';
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  Download,
  Layers,
  LayoutDashboard,
  Search,
  Settings,
  Sparkles,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ALL_AGENTS_FILTER_ID,
  buildProviderSidebarModel,
  sidebarWarnings,
  type ProviderFilterId,
  type ProviderSidebarItem,
} from './installed-skills-model';
import type { SkillsNavId } from './types';

const PRIMARY_NAV: {
  id: SkillsNavId;
  labelKey: string;
  icon: LucideIcon;
}[] = [
  { id: 'explore', labelKey: 'skills.nav.explore', icon: LayoutDashboard },
  { id: 'installed', labelKey: 'skills.nav.installed', icon: BookOpen },
  { id: 'install', labelKey: 'skills.nav.install', icon: Download },
  { id: 'presets', labelKey: 'skills.nav.presets', icon: Layers },
];

interface SkillsSidebarProps {
  active: SkillsNavId;
  onSelect: (id: SkillsNavId) => void;
}

export function SkillsSidebar({ active, onSelect }: SkillsSidebarProps) {
  const { t } = useTranslation();
  const commandContext = useCommandContext();
  const snapshot = useInstalledScanStore((state) => state.snapshot);
  const providerFilter = useInstalledSkillsUiStore((state) => state.providerFilter);
  const setProviderFilter = useInstalledSkillsUiStore((state) => state.setProviderFilter);
  const [inactiveOpen, setInactiveOpen] = useState(false);
  const [providerQuery, setProviderQuery] = useState('');

  const model = platform.hasLocalLibrary && snapshot ? buildProviderSidebarModel(snapshot) : null;

  const query = providerQuery.trim().toLowerCase();
  const matchesQuery = (name: string) => !query || name.toLowerCase().includes(query);

  const allAgentsLabel = t('skills.installed.allAgents');
  const universalLabel = t('skills.installed.universal');
  const showAllAgents = matchesQuery(allAgentsLabel);
  const showUniversal = model ? matchesQuery(universalLabel) : false;
  const filteredActiveProviders =
    model?.activeProviders.filter((item) => matchesQuery(item.name)) ?? [];
  const filteredInactiveProviders =
    model?.inactiveProviders.filter((item) => matchesQuery(item.name)) ?? [];
  const hasProviderMatches =
    showAllAgents ||
    showUniversal ||
    filteredActiveProviders.length > 0 ||
    filteredInactiveProviders.length > 0;
  const inactiveExpanded = inactiveOpen || query.length > 0;

  const handleOpenPreferences = async () => {
    const result = await executeCommand('open-preferences', commandContext);
    if (!result.success && result.error) {
      commandContext.showToast(result.error, 'error');
    }
  };

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
              onClick={() => onSelect(item.id)}
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
            <div className="min-h-0 flex-1 overflow-y-auto pb-2">
              <div className="px-3 py-1">
                <p className="text-muted-foreground text-xs font-medium uppercase">
                  {t('skills.installed.providersHeading')}
                </p>
              </div>

              <div className="mb-2 px-2">
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

              {showAllAgents ? (
                <ProviderRow
                  id={ALL_AGENTS_FILTER_ID}
                  name={allAgentsLabel}
                  skillCount={model.allAgentsCount}
                  selected={providerFilter === ALL_AGENTS_FILTER_ID}
                  onSelect={setProviderFilter}
                  icon={Sparkles}
                  installedTabActive={active === 'installed'}
                  onEnsureInstalledTab={() => onSelect('installed')}
                />
              ) : null}

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
                <div className="mt-3">
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 px-3 py-1"
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
                    <div className="mt-1 space-y-1 px-2">
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
                        <p className="text-muted-foreground px-1 py-2 text-xs">
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

      <div className="border-t p-2">
        <Button
          variant="ghost"
          className="text-muted-foreground w-full justify-start"
          onClick={handleOpenPreferences}
        >
          <Settings className="size-4" />
          {t('skills.nav.settings')}
        </Button>
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

  return (
    <button
      type="button"
      onClick={() => {
        onSelect(rowId);
        if (!installedTabActive) onEnsureInstalledTab();
      }}
      className={cn(
        'relative flex w-full items-center gap-2 rounded-md px-3 text-sm transition-colors',
        compact ? 'py-1.5 text-xs' : 'py-2',
        selected
          ? 'bg-background text-foreground font-medium shadow-xs'
          : 'text-muted-foreground hover:bg-background/70 hover:text-foreground',
      )}
    >
      {selected ? (
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
