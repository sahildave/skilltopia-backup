import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { AlertCircle, ExternalLink, Search, X } from 'lucide-react'
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
import type { SkillsShSkill } from '@/lib/tauri-bindings'
import {
  DISCOVERY_VIEWS,
  useSkillsLeaderboard,
  useSkillsSearch,
} from '@/services/skills-sh'
import { SkillDetailDialog } from './SkillDetailDialog'

function formatInstalls(count: number): string {
  return new Intl.NumberFormat(undefined, { notation: 'compact' }).format(count)
}

function SkillCard({
  skill,
  index,
  reduceMotion,
  compact = false,
  onOpen,
}: {
  skill: SkillsShSkill
  index: number
  reduceMotion: boolean
  compact?: boolean
  onOpen: (skill: SkillsShSkill) => void
}) {
  return (
    <motion.div
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      transition={
        reduceMotion
          ? { duration: 0.15 }
          : {
              type: 'spring',
              bounce: 0,
              duration: 0.35,
              delay: Math.min(index, 12) * 0.03,
            }
      }
      className={compact ? 'w-72 shrink-0' : undefined}
    >
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
        <CardFooter className="justify-end border-t px-4 pt-4">
          <Button variant="outline" size="sm" onClick={() => onOpen(skill)}>
            Details
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void openUrl(skill.url)}
            aria-label={`Open ${skill.name} on skills.sh`}
          >
            <ExternalLink data-icon="inline-start" /> View
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
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
  reduceMotion,
  onOpen,
}: {
  view: (typeof DISCOVERY_VIEWS)[number]
  reduceMotion: boolean
  onOpen: (skill: SkillsShSkill) => void
}) {
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
              ? 'Most installed across the catalog'
              : `The ${view.id} leaderboard right now`}
          </p>
        </div>
        <Badge variant="secondary" className="tabular-nums">
          {skills.length}
        </Badge>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Refresh failed</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {query.isLoading && skills.length === 0 ? <SkillsGridSkeleton /> : null}
      {skills.length > 0 ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          <AnimatePresence mode="popLayout">
            {skills.map((skill, index) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                index={index}
                reduceMotion={reduceMotion}
                onOpen={onOpen}
                compact
              />
            ))}
          </AnimatePresence>
        </div>
      ) : null}
    </section>
  )
}

function SearchResults({
  query,
  reduceMotion,
  onOpen,
}: {
  query: ReturnType<typeof useSkillsSearch>
  reduceMotion: boolean
  onOpen: (skill: SkillsShSkill) => void
}) {
  const skills = query.data ?? []
  const error = errorMessage(query.error)
  if (query.isLoading && skills.length === 0) return <SkillsGridSkeleton />
  if (error && skills.length === 0)
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Couldn’t load skills</AlertTitle>
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
          <EmptyTitle>No skills found</EmptyTitle>
          <EmptyDescription>Try a different search term.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence mode="popLayout">
        {skills.map((skill, index) => (
          <SkillCard
            key={skill.id}
            skill={skill}
            index={index}
            reduceMotion={reduceMotion}
            onOpen={onOpen}
          />
        ))}
      </AnimatePresence>
    </div>
  )
}

export function SkillsDashboardView() {
  const reduceMotion = useReducedMotion() ?? false
  const [searchInput, setSearchInput] = useState('')
  const debouncedQuery = useDebouncedValue(searchInput, 300)
  const isSearching = debouncedQuery.trim().length >= 2
  const search = useSkillsSearch(debouncedQuery, { enabled: isSearching })
  const hasSearchError = isSearching && Boolean(search.error)
  const [selectedSkill, setSelectedSkill] = useState<SkillsShSkill | null>(null)

  return (
    <div className="relative flex h-full flex-col">
      <div className="bg-background/80 sticky top-0 z-10 flex flex-col gap-4 border-b p-6 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-balance">Dashboard</h1>
          <Badge variant="outline">skills.sh</Badge>
        </div>
        <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
          Discover popular skills, refreshed from the live catalog and available
          offline from your last visit.
        </p>
        <InputGroup className="max-w-xl">
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
          <InputGroupInput
            value={searchInput}
            onChange={event => setSearchInput(event.target.value)}
            placeholder="Search skills…"
            aria-label="Search skills"
            autoComplete="off"
            spellCheck={false}
          />
          {searchInput ? (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                aria-label="Clear search"
                onClick={() => setSearchInput('')}
              >
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          ) : null}
        </InputGroup>
        {hasSearchError ? (
          <Alert variant="destructive" className="max-w-xl">
            <AlertCircle />
            <AlertTitle>Couldn’t load search results</AlertTitle>
            <AlertDescription>{errorMessage(search.error)}</AlertDescription>
          </Alert>
        ) : null}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-10 p-6">
          {isSearching ? (
            <SearchResults
              query={search}
              reduceMotion={reduceMotion}
              onOpen={setSelectedSkill}
            />
          ) : (
            DISCOVERY_VIEWS.map(view => (
              <DiscoveryRail
                key={view.id}
                view={view}
                reduceMotion={reduceMotion}
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
