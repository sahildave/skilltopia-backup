import { useEffect, useState } from 'react'
import {
  FileText,
  Folder,
  LoaderCircle,
  RotateCcw,
  ShieldAlert,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { platform } from '@platform'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DESKTOP_APP_DOWNLOAD_URL } from '@/lib/desktop-download'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { isPermissionError } from './library-errors'
import type { SkillEntry, SkillProvider } from './types'

export function SkillsLibraryView() {
  if (!platform.hasLocalLibrary) {
    return <LibraryUnavailableStub />
  }

  return <LocalLibraryView />
}

function LibraryUnavailableStub() {
  const { t } = useTranslation()

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex max-w-md flex-col items-center gap-3">
        <h1 className="text-2xl font-semibold text-balance">
          {t('skills.library.title')}
        </h1>
        <p className="text-muted-foreground text-sm text-pretty">
          {t('skills.library.webUnavailable')}
        </p>
        <p className="text-muted-foreground text-sm text-pretty">
          {t('skills.library.getAppDescription')}
        </p>
      </div>
      <Button
        size="lg"
        onClick={() => void platform.openExternal(DESKTOP_APP_DOWNLOAD_URL)}
      >
        {t('skills.library.getApp')}
      </Button>
    </div>
  )
}

function LocalLibraryView() {
  const { t } = useTranslation()
  const [entries, setEntries] = useState<SkillEntry[] | null>(null)
  const [providers, setProviders] = useState<SkillProvider[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleRead = async () => {
    setLoading(true)
    setError(null)

    try {
      const [nextEntries, nextProviders] = await Promise.all([
        platform.listInstalled(),
        platform.listProviders(),
      ])
      setEntries(nextEntries)
      setProviders(nextProviders)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setEntries(null)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void handleRead()
  }, [])

  const showPermissionCard = error !== null && isPermissionError(error)
  const sortedEntries = entries
    ? [...entries].sort((a, b) => a.name.localeCompare(b.name))
    : []

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex flex-col gap-5 border-b p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold text-balance">
                {t('skills.library.installedTitle')}
              </h1>
              {entries ? (
                <Badge variant="secondary" className="tabular-nums">
                  {entries.length}
                </Badge>
              ) : null}
            </div>
            <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
              {t('skills.library.installedDescription')}{' '}
              <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
                ~/.agents/skills
              </code>
              .
            </p>
          </div>
          <Button onClick={handleRead} disabled={loading}>
            {loading ? (
              <LoaderCircle data-icon="inline-start" />
            ) : (
              <RotateCcw data-icon="inline-start" />
            )}
            {t('skills.library.rescan')}
          </Button>
        </div>

        <section
          className="flex flex-col gap-2"
          aria-labelledby="providers-title"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="providers-title" className="text-sm font-medium">
              {t('skills.library.providers.title')}
            </h2>
            {loading ? (
              <span className="text-muted-foreground text-xs">
                {t('skills.library.scanning')}
              </span>
            ) : null}
          </div>
          <div
            className="flex flex-wrap gap-2"
            aria-label={t('skills.library.providers.title')}
          >
            <Badge variant="default" className="gap-2 px-3 py-1">
              <span>{t('skills.library.providers.universal')}</span>
              <span className="tabular-nums">{sortedEntries.length}</span>
            </Badge>
            {providers.map(provider => (
              <Badge key={provider.id} variant="outline" className="px-3 py-1">
                {provider.name}
              </Badge>
            ))}
          </div>
        </section>
      </div>

      <div className="relative min-h-0 flex-1">
        {showPermissionCard ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 p-6">
            <Card className="w-full max-w-md shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="size-4" />
                  {t('skills.library.permissionRequired')}
                </CardTitle>
                <CardDescription className="text-pretty">
                  {t('skills.library.permissionDescriptionStart')}{' '}
                  <code className="bg-muted rounded px-1 py-0.5 text-xs">
                    ~/.agents/skills
                  </code>
                  . {t('skills.library.permissionDescriptionEnd')}{' '}
                  <code className="bg-muted rounded px-1 py-0.5 text-xs">
                    src-tauri/capabilities/
                  </code>
                  .
                </CardDescription>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs text-pretty whitespace-pre-wrap">
                  {error}
                </pre>
              </CardContent>
              <CardFooter>
                <Button
                  variant="outline"
                  onClick={handleRead}
                  disabled={loading}
                >
                  {t('skills.library.tryAgain')}
                </Button>
              </CardFooter>
            </Card>
          </div>
        ) : null}

        <ScrollArea className="h-full">
          <div className="p-6">
            {error && !showPermissionCard ? (
              <Alert variant="destructive">
                <ShieldAlert />
                <AlertTitle>{t('skills.library.readFailed')}</AlertTitle>
                <AlertDescription className="flex flex-col gap-3">
                  <span>{t('skills.library.readFailedDescription')}</span>
                  <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs whitespace-pre-wrap">
                    {error}
                  </pre>
                </AlertDescription>
              </Alert>
            ) : null}

            {!error && loading && entries === null ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 6 }, (_, index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            ) : null}

            {!error && entries && entries.length === 0 ? (
              <Empty className="min-h-80 border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <Folder />
                  </EmptyMedia>
                  <EmptyTitle>{t('skills.library.emptyTitle')}</EmptyTitle>
                  <EmptyDescription>
                    {t('skills.library.emptyDescription')}
                  </EmptyDescription>
                </EmptyHeader>
                <EmptyContent>
                  <Button onClick={handleRead} disabled={loading}>
                    {t('skills.library.rescan')}
                  </Button>
                </EmptyContent>
              </Empty>
            ) : null}

            {sortedEntries.length > 0 ? (
              <Card className="gap-0 py-0">
                <CardHeader className="border-b px-4 py-3">
                  <CardTitle className="text-sm">
                    {t('skills.library.listTitle')}
                  </CardTitle>
                  <CardDescription>
                    {t('skills.library.listDescription')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {sortedEntries.map(entry => (
                      <div
                        key={entry.name}
                        className="flex min-h-14 items-center justify-between gap-4 px-4 py-3"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          {entry.isDirectory ? (
                            <Folder className="text-muted-foreground size-4" />
                          ) : (
                            <FileText className="text-muted-foreground size-4" />
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">
                              {entry.name}
                            </p>
                            <p className="text-muted-foreground truncate text-xs">
                              {t('skills.library.globalSource')}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <Badge variant="outline">
                            {t('skills.library.providers.universal')}
                          </Badge>
                          <Badge variant="secondary">
                            {t(`skills.library.kind.${entryKindLabel(entry)}`)}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

function entryKindLabel(entry: SkillEntry): string {
  if (entry.isDirectory) return 'directory'
  if (entry.isSymlink) return 'symlink'
  if (entry.isFile) return 'file'
  return 'unknown'
}
