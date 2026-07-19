import { AlertCircle, ExternalLink, LoaderCircle } from 'lucide-react'
import { openUrl } from '@tauri-apps/plugin-opener'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { useSkillDetail } from '@/services/skills-sh'
import type { SkillsShSkill } from '@/lib/tauri-bindings'

function titleForSkill(skillId: string): string {
  return skillId.split('/').at(-1)?.replaceAll('-', ' ') ?? skillId
}

function DetailList({ values }: { values: string[] }) {
  if (values.length === 0)
    return <span className="text-muted-foreground text-sm">Not specified</span>
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map(value => (
        <Badge key={value} variant="outline">
          {value}
        </Badge>
      ))}
    </div>
  )
}

export function SkillDetailDialog({
  skill,
  onOpenChange,
  onSelectRelated,
}: {
  skill: SkillsShSkill | null
  onOpenChange: (open: boolean) => void
  onSelectRelated: (skillId: string) => void
}) {
  const query = useSkillDetail(skill?.id ?? null)
  const enrichment = query.data?.enrichment
  const isOpen = skill !== null

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-balance">
            {skill?.name ?? 'Skill details'}
          </DialogTitle>
          <DialogDescription className="text-pretty">
            {skill?.id}
          </DialogDescription>
        </DialogHeader>

        {query.isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
            <LoaderCircle className="size-4 animate-spin" /> Loading enrichment…
          </div>
        ) : query.error ? (
          <Alert variant="destructive">
            <AlertCircle />
            <AlertTitle>Couldn’t load details</AlertTitle>
            <AlertDescription>
              {query.error instanceof Error
                ? query.error.message
                : String(query.error)}
            </AlertDescription>
          </Alert>
        ) : enrichment ? (
          <div className="flex flex-col gap-5">
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Primary goal</h3>
              <p className="text-muted-foreground text-sm text-pretty">
                {enrichment.required.primaryGoal}
              </p>
            </section>
            <div className="grid gap-4 sm:grid-cols-2">
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Difficulty</h3>
                <Badge variant="secondary" className="w-fit capitalize">
                  {enrichment.required.estimatedComplexity}
                </Badge>
              </section>
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Read time</h3>
                <p className="text-muted-foreground text-sm tabular-nums">
                  {enrichment.estimatedReadTimeMinutes} min
                </p>
              </section>
            </div>
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Requires</h3>
              <DetailList values={enrichment.required.requires} />
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">Best for</h3>
              <DetailList values={enrichment.required.bestFor} />
            </section>
            <Separator />
            <section className="flex flex-col gap-3">
              <div>
                <h3 className="text-sm font-semibold">Related skills</h3>
                <p className="text-muted-foreground text-xs">
                  Similar skills from the enriched catalog
                </p>
              </div>
              {(query.data?.related ?? []).length > 0 ? (
                <div className="flex flex-col gap-2">
                  {(query.data?.related ?? []).map(related => (
                    <Button
                      key={related.skillId}
                      variant="outline"
                      className="h-auto justify-between gap-3 px-3 py-2 text-start"
                      onClick={() => onSelectRelated(related.skillId)}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium capitalize">
                          {titleForSkill(related.skillId)}
                        </span>
                        <span className="text-muted-foreground block truncate text-xs">
                          {related.skillId}
                        </span>
                      </span>
                      <Badge
                        variant="secondary"
                        className="shrink-0 tabular-nums"
                      >
                        {Math.round(related.score * 100)}%
                      </Badge>
                    </Button>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  No related skills are available yet.
                </p>
              )}
            </section>
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-4">
            <p className="text-muted-foreground text-sm text-pretty">
              This skill has catalog metadata, but enrichment is not available
              yet.
            </p>
            {skill ? (
              <Button
                variant="outline"
                className="w-fit"
                onClick={() => void openUrl(skill.url)}
              >
                <ExternalLink data-icon="inline-start" /> Open on skills.sh
              </Button>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
