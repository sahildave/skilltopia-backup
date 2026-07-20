import { useState } from 'react'
import { AlertCircle, ChevronDown, ExternalLink, Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { platform } from '@platform'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import type { SkillsShSkill } from '@/catalog/types'
import {
  DISCOVERY_VIEWS,
  useSkillsLeaderboard,
  useSkillsSearch,
} from '@/services/skills-sh'
import { isInstallCancelled, isPermissionError } from './library-errors'
import { SkillDetailDialog } from './SkillDetailDialog'
import type { InstallScope } from './types'

function formatInstalls(count: number): string {
  return new Intl.NumberFormat(undefined, { notation: 'compact' }).format(count)
}

function SkillInstallMenu({ skill }: { skill: SkillsShSkill }) {
  const { t } = useTranslation()
  const [installing, setInstalling] = useState(false)
  const copiesCommand = platform.copiesInstallCommand

  const handleInstall = async (scope: InstallScope) => {
    setInstalling(true)
    try {
      await platform.install(
        {
          id: skill.id,
          name: skill.name,
          installUrl: skill.installUrl,
        },
        scope
      )
      toast.success(
        t(copiesCommand ? 'skills.install.copied' : 'skills.install.success', {
          name: skill.name,
        })
      )
    } catch (error) {
      if (isInstallCancelled(error)) return
      const message = error instanceof Error ? error.message : String(error)
      if (isPermissionError(message)) {
        toast.error(t('skills.install.permissionError'), {
          description: message,
        })
      } else {
        toast.error(
          t(
            copiesCommand
              ? 'skills.install.copyFailed'
              : 'skills.install.failed',
            { name: skill.name }
          ),
          { description: message }
        )
      }
    } finally {
      setInstalling(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" size="sm" disabled={installing}>
          {t(
            copiesCommand
              ? 'skills.install.copyAction'
              : 'skills.install.action'
          )}
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={installing}
          onSelect={() => void handleInstall('global')}
        >
          {t(
            copiesCommand
              ? 'skills.install.copyGlobal'
              : 'skills.install.global'
          )}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={installing}
          onSelect={() => void handleInstall('project')}
        >
          {t(
            copiesCommand
              ? 'skills.install.copyProject'
              : 'skills.install.project'
          )}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SkillCard({
  skill,
  compact = false,
  onOpen,
}: {
  skill: SkillsShSkill
  compact?: boolean
  onOpen: (skill: SkillsShSkill) => void
}) {
  const { t } = useTranslation()

  return (
    <div className={compact ? 'w-72 shrink-0' : undefined}>
      <Card className="gap-4 py-4">
        <CardHeader className="px-4">
          <CardTitle className="flex items-start justify-between gap-2 text-sm">
            <span className="truncate text-balance">{skill.name}</span>
            <Badge variant="secondary" className="shrink-0 tabular-nums">
              {formatInstalls(skill.installs)}
            </Badge>
          </CardTitle>
          <CardDescription className="truncate text-pretty">
            {skill.source}
          </CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{skill.sourceType}</Badge>
            <Badge variant="outline" className="max-w-full truncate">
              {skill.slug}
            </Badge>
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-1 border-t px-4 pt-4">
          <SkillInstallMenu skill={skill} />
          <Button variant="outline" size="sm" onClick={() => onOpen(skill)}>
            {t('skills.dashboard.details')}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void platform.openExternal(skill.url)}
            aria-label={t('skills.dashboard.openExternalLabel', {
              name: skill.name,
            })}
          >
            <ExternalLink data-icon="inline-start" />
            {t('skills.dashboard.view')}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

function SkillsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }, (_, index) => (
        <Card key={index} className="gap-4 py-4">
          <CardHeader className="px-4">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
          </CardHeader>
          <CardContent className="px-4">
            <div className="flex gap-1.5">
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-5 w-20" />
            </div>
          </CardContent>
          <CardFooter className="border-t px-4 pt-4">
            <Skeleton className="ml-auto h-8 w-16" />
          </CardFooter>
        </Card>
      ))}
    </div>
  )
}

function errorMessage(error: unknown): string | null {
  return error instanceof Error ? error.message : error ? String(error) : null
}

function DiscoveryRail({
  view,
  onOpen,
}: {
  view: (typeof DISCOVERY_VIEWS)[number]
  onOpen: (skill: SkillsShSkill) => void
}) {
  const { t } = useTranslation()
  const query = useSkillsLeaderboard({ view: view.id, perPage: 12 })
  const skills = query.data ?? []
  const error = errorMessage(query.error)

  return (
    <section
      aria-labelledby={`rail-${view.id}`}
      className="flex flex-col gap-3"
    >
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 id={`rail-${view.id}`} className="text-base font-semibold">
            {view.label}
          </h2>
          <p className="text-muted-foreground text-xs">
            {view.id === 'all-time'
              ? t('skills.dashboard.rail.allTimeDescription')
              : t('skills.dashboard.rail.currentDescription', {
                  view: view.label,
                })}
          </p>
        </div>
        <Badge variant="secondary" className="tabular-nums">
          {skills.length}
        </Badge>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{t('skills.dashboard.refreshFailed')}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {query.isLoading && skills.length === 0 ? <SkillsGridSkeleton /> : null}
      {skills.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {skills.map(skill => (
            <SkillCard key={skill.id} skill={skill} onOpen={onOpen} compact />
          ))}
        </div>
      ) : null}
    </section>
  )
}

function SearchResults({
  query,
  onOpen,
}: {
  query: ReturnType<typeof useSkillsSearch>
  onOpen: (skill: SkillsShSkill) => void
}) {
  const { t } = useTranslation()
  const skills = query.data ?? []
  const error = errorMessage(query.error)
  const isRefreshing = query.isFetching && skills.length > 0
  if (query.isLoading && skills.length === 0) return <SkillsGridSkeleton />
  if (error && skills.length === 0)
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>{t('skills.dashboard.loadFailed')}</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  if (skills.length === 0)
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Search />
          </EmptyMedia>
          <EmptyTitle>{t('skills.dashboard.noResultsTitle')}</EmptyTitle>
          <EmptyDescription>
            {t('skills.dashboard.noResultsDescription')}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  return (
    <div className="flex flex-col gap-3">
      {isRefreshing ? (
        <p className="text-muted-foreground text-xs">
          {t('skills.dashboard.refreshing')}
        </p>
      ) : null}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {skills.map(skill => (
          <SkillCard key={skill.id} skill={skill} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}

export function SkillsDashboardView() {
  const { t } = useTranslation()
  const [searchInput, setSearchInput] = useState('')
  const debouncedQuery = useDebouncedValue(searchInput, 300)
  const isSearching = debouncedQuery.trim().length >= 2
  const search = useSkillsSearch(debouncedQuery, { enabled: isSearching })
  const hasSearchError = isSearching && Boolean(search.error)
  const [selectedSkill, setSelectedSkill] = useState<SkillsShSkill | null>(null)

  return (
    <div className="relative flex h-full flex-col">
      <div className="app-material app-scroll-edge sticky top-0 z-10 flex flex-col gap-4 p-6">
        <div className="flex flex-col items-start gap-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-balance">
              {t('skills.dashboard.title')}
            </h1>
            <Badge variant="outline">skills.sh</Badge>
          </div>
          <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
            {t('skills.dashboard.description')}
          </p>
        </div>
        <InputGroup className="max-w-xl">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={searchInput}
            onChange={event => setSearchInput(event.target.value)}
            placeholder={t('skills.dashboard.searchPlaceholder')}
            aria-label={t('skills.dashboard.searchLabel')}
            autoComplete="off"
            spellCheck={false}
          />
          {searchInput ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label={t('skills.dashboard.clearSearch')}
                onClick={() => setSearchInput('')}
                className="app-pressable"
              >
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
        {hasSearchError ? (
          <Alert variant="destructive" className="max-w-xl">
            <AlertCircle />
            <AlertTitle>{t('skills.dashboard.searchFailed')}</AlertTitle>
            <AlertDescription>{errorMessage(search.error)}</AlertDescription>
          </Alert>
        ) : null}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-10 p-6">
          {isSearching ? (
            <SearchResults query={search} onOpen={setSelectedSkill} />
          ) : (
            DISCOVERY_VIEWS.map(view => (
              <DiscoveryRail
                key={view.id}
                view={view}
                onOpen={setSelectedSkill}
              />
            ))
          )}
        </div>
      </ScrollArea>
      <SkillDetailDialog
        skill={selectedSkill}
        onOpenChange={open => {
          if (!open) setSelectedSkill(null)
        }}
        onSelectRelated={skillId => {
          setSelectedSkill({
            id: skillId,
            slug: skillId.split('/').at(-1) ?? skillId,
            name: skillId.split('/').at(-1) ?? skillId,
            source: skillId.split('/')[0] ?? '',
            installs: 0,
            sourceType: 'github',
            url: `https://skills.sh/skills/${skillId}`,
          })
        }}
      />
    </div>
  )
}
