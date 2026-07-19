import { useState } from 'react'
import { FileText, Folder, LoaderCircle, ShieldAlert } from 'lucide-react'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { isPermissionError, readGlobalSkills } from './read-global-skills'
import type { SkillEntry } from './types'

export function SkillsLibraryView() {
  const [entries, setEntries] = useState<SkillEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleRead = async () => {
    setLoading(true)
    setError(null)

    try {
      const next = await readGlobalSkills()
      setEntries(next)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setEntries(null)
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const showPermissionCard = error !== null && isPermissionError(error)

  return (
    <div className="relative flex h-full flex-col">
      <div className="flex flex-col gap-4 border-b p-6">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-balance">Library</h1>
          {entries ? (
            <Badge variant="secondary" className="tabular-nums">
              {entries.length}
            </Badge>
          ) : null}
        </div>
        <p className="text-muted-foreground max-w-2xl text-sm text-pretty">
          <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
            ~/.agents/skills
          </code>
          .
        </p>
        <div>
          <Button onClick={handleRead} disabled={loading}>
            {loading ? <LoaderCircle className="size-4 animate-spin" /> : null}
            Read ~/.agents/skills
          </Button>
        </div>
      </div>

      <div className="relative min-h-0 flex-1">
        {showPermissionCard ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 p-6">
            <Card className="w-full max-w-md shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldAlert className="size-4" />
                  Permission required
                </CardTitle>
                <CardDescription className="text-pretty">
                  This app needs read access to{' '}
                  <code className="bg-muted rounded px-1 py-0.5 text-xs">
                    ~/.agents/skills
                  </code>
                  . Check the fs plugin scope in{' '}
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
                  Try again
                </Button>
              </CardFooter>
            </Card>
          </div>
        ) : null}

        <ScrollArea className="h-full">
          <div className="p-6">
            {error && !showPermissionCard ? (
              <Card className="border-destructive/40">
                <CardHeader>
                  <CardTitle className="text-destructive text-base">
                    Failed to read skills
                  </CardTitle>
                  <CardDescription className="text-pretty">
                    The folder could not be read. The raw error is shown below.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted overflow-x-auto rounded-md p-3 text-xs whitespace-pre-wrap">
                    {error}
                  </pre>
                </CardContent>
              </Card>
            ) : null}

            {!error && entries === null ? (
              <p className="text-muted-foreground text-sm text-pretty">
                Click the button above to list entries in{' '}
                <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
                  ~/.agents/skills
                </code>
                .
              </p>
            ) : null}

            {entries && entries.length === 0 ? (
              <p className="text-muted-foreground text-sm text-pretty">
                The folder exists but contains no entries.
              </p>
            ) : null}

            {entries && entries.length > 0 ? (
              <div className="grid grid-cols-3 gap-4">
                {entries.map(entry => (
                  <Card key={entry.name} className="gap-4 py-4">
                    <CardHeader className="px-4">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        {entry.isDirectory ? (
                          <Folder className="text-muted-foreground size-4" />
                        ) : (
                          <FileText className="text-muted-foreground size-4" />
                        )}
                        <span className="truncate">{entry.name}</span>
                      </CardTitle>
                      <CardDescription className="text-pretty">
                        Global skill from ~/.agents/skills
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="px-4">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge variant="outline">global</Badge>
                        <Badge variant="outline">{entryKindLabel(entry)}</Badge>
                      </div>
                    </CardContent>
                    <CardFooter
                      className={cn(
                        'text-muted-foreground justify-between border-t px-4 pt-4 text-xs'
                      )}
                    >
                      <span>local</span>
                      <span>Installed</span>
                    </CardFooter>
                  </Card>
                ))}
              </div>
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
