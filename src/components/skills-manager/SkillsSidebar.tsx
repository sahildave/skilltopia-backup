import { useState } from 'react'
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  Download,
  LayoutDashboard,
  Layers,
  Settings,
  Sparkles,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { platform } from '@platform'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useInstalledScanStore } from '@/store/installed-scan-store'
import { useInstalledSkillsUiStore } from '@/store/installed-skills-ui-store'
import {
  ALL_AGENTS_FILTER_ID,
  buildProviderSidebarModel,
  sidebarWarnings,
  type ProviderFilterId,
  type ProviderSidebarItem,
} from './installed-skills-model'
import type { SkillsNavId } from './types'

const PRIMARY_NAV: {
  id: SkillsNavId
  labelKey: string
  icon: typeof BookOpen
}[] = [
  { id: 'dashboard', labelKey: 'skills.nav.dashboard', icon: LayoutDashboard },
  { id: 'library', labelKey: 'skills.nav.installed', icon: BookOpen },
  { id: 'install', labelKey: 'skills.nav.install', icon: Download },
  { id: 'presets', labelKey: 'skills.nav.presets', icon: Layers },
]

interface SkillsSidebarProps {
  active: SkillsNavId
  onSelect: (id: SkillsNavId) => void
}

export function SkillsSidebar({ active, onSelect }: SkillsSidebarProps) {
  const { t } = useTranslation()
  const snapshot = useInstalledScanStore(state => state.snapshot)
  const providerFilter = useInstalledSkillsUiStore(
    state => state.providerFilter
  )
  const setProviderFilter = useInstalledSkillsUiStore(
    state => state.setProviderFilter
  )
  const [inactiveOpen, setInactiveOpen] = useState(false)
  const [inactiveQuery, setInactiveQuery] = useState('')

  const model =
    platform.hasLocalLibrary && snapshot
      ? buildProviderSidebarModel(snapshot)
      : null

  const inactiveFiltered =
    model?.inactiveProviders.filter(item =>
      item.name.toLowerCase().includes(inactiveQuery.trim().toLowerCase())
    ) ?? []

  return (
    <div className="flex h-full flex-col bg-muted/40">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-md text-sm font-semibold">
          S
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-balance">
            {t('skills.nav.brand')}
          </p>
          <p className="text-muted-foreground truncate text-xs">
            {t('skills.nav.tagline')}
          </p>
        </div>
      </div>

      <nav
        className="flex flex-1 flex-col gap-1 overflow-hidden px-2"
        aria-label="Primary"
      >
        {PRIMARY_NAV.map(item => {
          const Icon = item.icon
          const isActive = active === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={cn(
                'relative flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                isActive
                  ? 'bg-background text-foreground font-medium shadow-xs'
                  : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
              )}
            >
              {isActive ? (
                <span
                  aria-hidden
                  className="bg-primary absolute inset-y-1 start-0 w-0.5 rounded-full"
                />
              ) : null}
              <Icon className="size-4 shrink-0" />
              <span className="truncate">{t(item.labelKey)}</span>
            </button>
          )
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

              <ProviderRow
                id={ALL_AGENTS_FILTER_ID}
                name={t('skills.installed.allAgents')}
                skillCount={model.allAgentsCount}
                selected={providerFilter === ALL_AGENTS_FILTER_ID}
                onSelect={setProviderFilter}
                icon={Sparkles}
                installedTabActive={active === 'library'}
                onEnsureInstalledTab={() => onSelect('library')}
              />

              <ProviderRow
                item={{
                  ...model.universal,
                  name: t('skills.installed.universal'),
                }}
                selected={providerFilter === model.universal.id}
                onSelect={setProviderFilter}
                installedTabActive={active === 'library'}
                onEnsureInstalledTab={() => onSelect('library')}
              />

              {model.activeProviders.map(item => (
                <ProviderRow
                  key={item.id}
                  item={item}
                  selected={providerFilter === item.id}
                  onSelect={setProviderFilter}
                  installedTabActive={active === 'library'}
                  onEnsureInstalledTab={() => onSelect('library')}
                />
              ))}
            </div>

            <div className="mt-3 shrink-0 pb-2">
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 px-3 py-1"
                onClick={() => setInactiveOpen(open => !open)}
                aria-expanded={inactiveOpen}
              >
                <ChevronDown
                  className={cn(
                    'size-3.5 shrink-0 transition-transform',
                    !inactiveOpen && '-rotate-90'
                  )}
                />
                <span className="truncate text-xs font-medium uppercase">
                  {t('skills.installed.inactiveProviders')}
                </span>
                <span className="bg-muted ms-auto rounded-md px-1.5 py-0.5 text-xs tabular-nums">
                  {model.inactiveProviders.length}
                </span>
              </button>

              {inactiveOpen ? (
                <div className="mt-1 space-y-1 px-2">
                  <Input
                    value={inactiveQuery}
                    onChange={event => setInactiveQuery(event.target.value)}
                    placeholder={t('skills.installed.searchProviders')}
                    className="h-8 text-xs"
                    aria-label={t('skills.installed.searchProviders')}
                  />
                  {inactiveFiltered.map(item => (
                    <ProviderRow
                      key={item.id}
                      item={item}
                      selected={providerFilter === item.id}
                      onSelect={setProviderFilter}
                      installedTabActive={active === 'library'}
                      onEnsureInstalledTab={() => onSelect('library')}
                      compact
                    />
                  ))}
                  {inactiveFiltered.length === 0 ? (
                    <p className="text-muted-foreground px-1 py-2 text-xs">
                      {t('skills.installed.noMatchingProviders')}
                    </p>
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
          disabled
        >
          <Settings className="size-4" />
          {t('skills.nav.settings')}
        </Button>
      </div>
    </div>
  )
}

function ProviderRow(props: {
  item?: ProviderSidebarItem
  id?: ProviderFilterId
  name?: string
  skillCount?: number
  selected: boolean
  onSelect: (id: ProviderFilterId) => void
  icon?: typeof Sparkles
  installedTabActive: boolean
  onEnsureInstalledTab: () => void
  compact?: boolean
}) {
  const {
    item,
    selected,
    onSelect,
    icon: Icon,
    installedTabActive,
    onEnsureInstalledTab,
    compact = false,
  } = props
  const rowId = item?.id ?? props.id
  const rowName = item?.name ?? props.name
  if (rowId === undefined || rowName === undefined) {
    return null
  }
  const count = item?.skillCount ?? props.skillCount ?? 0
  const hasWarning = sidebarWarnings(item?.warnings ?? []).length > 0

  return (
    <button
      type="button"
      onClick={() => {
        onSelect(rowId)
        if (!installedTabActive) onEnsureInstalledTab()
      }}
      className={cn(
        'relative flex w-full items-center gap-2 rounded-md px-3 text-sm transition-colors',
        compact ? 'py-1.5 text-xs' : 'py-2',
        selected
          ? 'bg-background text-foreground font-medium shadow-xs'
          : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
      )}
    >
      {selected ? (
        <span
          aria-hidden
          className="bg-primary absolute inset-y-1 start-0 w-0.5 rounded-full"
        />
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
  )
}
