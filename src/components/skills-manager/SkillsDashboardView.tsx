import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { openUrl } from '@tauri-apps/plugin-opener'
import {
  AlertCircle,
  ExternalLink,
  LayoutDashboard,
  Search,
  X,
} from 'lucide-react'
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
  EmptyContent,
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
import { cn } from '@/lib/utils'
import { useSkillsLeaderboard, useSkillsSearch } from '@/services/skills-sh'

function formatInstalls(count: number): string {
  return new Intl.NumberFormat(undefined, { notation: 'compact' }).format(count)
}

function SkillCard({
  skill,
  index,
  reduceMotion,
}: {
  skill: SkillsShSkill
  index: number
  reduceMotion: boolean
}) {
  const handleOpen = () => {
    void openUrl(skill.url)
  }

  return (
    <motion.div
      layout
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 }}
      transition={
        reduceMotion
          ? { duration: 0.15, ease: 'easeOut' }
          : {
              type: 'spring',
              bounce: 0,
              duration: 0.35,
              delay: Math.min(index, 12) * 0.03,
            }
      }
    >
      <Card className="gap-4 py-4">
        <CardHeader className="px-4">
          <CardTitle className="flex items-start justify-between gap-2 text-sm">
            <span className="truncate text-balance">{skill.name}</span>
            <Badge variant="secondary" className="tabular-nums shrink-0">
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
            <Badge variant="outline" className="truncate max-w-full">
              {skill.slug}
            </Badge>
          </div>
        </CardContent>
        <CardFooter className="justify-end border-t px-4 pt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleOpen}
            aria-label={`Open ${skill.name} on skills.sh`}
          >
            <ExternalLink data-icon="inline-start" />
            View
          </Button>
        </CardFooter>
      </Card>
    </motion.div>
  )
}

function SkillsGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 9 }, (_, index) => (
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

export function SkillsDashboardView() {
  const reduceMotion = useReducedMotion() ?? false
  const [searchInput, setSearchInput] = useState('')
  const debouncedQuery = useDebouncedValue(searchInput, 300)
  const isSearching = debouncedQuery.trim().length >= 2

  const leaderboard = useSkillsLeaderboard({ enabled: !isSearching })
  const search = useSkillsSearch(debouncedQuery, { enabled: isSearching })

  const activeQuery = isSearching ? search : leaderboard
  const skills = activeQuery.data ?? []
  const isLoading = activeQuery.isLoading || activeQuery.isFetching
  const errorMessage =
    activeQuery.error instanceof Error
      ? activeQuery.error.message
      : activeQuery.error
        ? String(activeQuery.error)
        : null

  return (
    <div className="relative flex h-full flex-col">
      <div
        className={cn(
          'bg-background/80 sticky top-0 z-10 flex flex-col gap-4 border-b p-6 backdrop-blur-md'
        )}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-balance">Dashboard</h1>
          {!isLoading && skills.length > 0 ? (
            <Badge variant="secondary" className="tabular-nums">
              {skills.length}
            </Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
          Browse the top skills on skills.sh. Search by name or description.
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

        {errorMessage ? (
          <Alert variant="destructive" className="max-w-xl">
            <AlertCircle />
            <AlertTitle>Couldn’t load skills</AlertTitle>
            <AlertDescription className="text-pretty">
              {errorMessage}
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="p-6">
          {isLoading && skills.length === 0 ? <SkillsGridSkeleton /> : null}

          {!isLoading && skills.length === 0 && !errorMessage ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <LayoutDashboard />
                </EmptyMedia>
                <EmptyTitle>
                  {isSearching ? 'No skills found' : 'No skills yet'}
                </EmptyTitle>
                <EmptyDescription>
                  {isSearching
                    ? 'Try a different search term, or clear the search to see the top skills.'
                    : 'The catalog returned no results. Try again in a moment.'}
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                {isSearching ? (
                  <Button variant="outline" onClick={() => setSearchInput('')}>
                    Clear search
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => void activeQuery.refetch()}
                  >
                    Retry
                  </Button>
                )}
              </EmptyContent>
            </Empty>
          ) : null}

          {skills.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <AnimatePresence mode="popLayout">
                {skills.map((skill, index) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    index={index}
                    reduceMotion={reduceMotion}
                  />
                ))}
              </AnimatePresence>
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  )
}
