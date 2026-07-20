import { useEffect, useState } from 'react';
import { AlertCircle, ExternalLink, LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { platform } from '@platform';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MorphingDialogSubtitle, MorphingDialogTitle } from '@/components/ui/morphing-dialog';
import { Separator } from '@/components/ui/separator';
import { useSkillDetail } from '@/services/skills-sh';
import type { SkillsShSkill } from '@/catalog/types';

function titleForSkill(skillId: string): string {
  return skillId.split('/').at(-1)?.replaceAll('-', ' ') ?? skillId;
}

function skillStubFromId(skillId: string): SkillsShSkill {
  return {
    id: skillId,
    slug: skillId.split('/').at(-1) ?? skillId,
    name: skillId.split('/').at(-1) ?? skillId,
    source: skillId.split('/')[0] ?? '',
    installs: 0,
    sourceType: 'github',
    url: `https://skills.sh/skills/${skillId}`,
  };
}

function DetailList({ values }: { values: string[] }) {
  const { t } = useTranslation();
  if (values.length === 0)
    return <span className="text-muted-foreground text-sm">{t('skills.detail.notSpecified')}</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((value) => (
        <Badge key={value} variant="outline">
          {value}
        </Badge>
      ))}
    </div>
  );
}

/** Detail panel body for MorphingDialog — keeps related-skill navigation local. */
export function SkillDetailBody({ skill: initialSkill }: { skill: SkillsShSkill }) {
  const { t } = useTranslation();
  const [skill, setSkill] = useState(initialSkill);
  const query = useSkillDetail(skill.id);
  const enrichment = query.data?.enrichment;

  useEffect(() => {
    setSkill(initialSkill);
  }, [initialSkill]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 pe-8">
        <MorphingDialogTitle className="text-lg leading-none font-semibold text-balance">
          {skill.name}
        </MorphingDialogTitle>
        <MorphingDialogSubtitle className="text-muted-foreground text-sm text-pretty">
          {skill.id}
        </MorphingDialogSubtitle>
      </div>

      {query.isLoading ? (
        <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
          <LoaderCircle className="size-4 animate-spin" />
          {t('skills.detail.loading')}
        </div>
      ) : query.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{t('skills.detail.loadFailed')}</AlertTitle>
          <AlertDescription>
            {query.error instanceof Error ? query.error.message : String(query.error)}
          </AlertDescription>
        </Alert>
      ) : enrichment ? (
        <div className="flex flex-col gap-5">
          <section className="rounded-lg border bg-muted/30 p-4">
            <h3 className="text-sm font-semibold">{t('skills.detail.primaryGoal')}</h3>
            <p className="text-muted-foreground mt-2 text-sm text-pretty">
              {enrichment.required.primaryGoal}
            </p>
          </section>
          <div className="grid gap-4 sm:grid-cols-2">
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{t('skills.detail.difficulty')}</h3>
              <Badge variant="secondary" className="w-fit capitalize">
                {enrichment.required.estimatedComplexity}
              </Badge>
            </section>
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{t('skills.detail.readTime')}</h3>
              <p className="text-muted-foreground text-sm tabular-nums">
                {t('skills.detail.minutes', {
                  count: enrichment.estimatedReadTimeMinutes,
                })}
              </p>
            </section>
          </div>
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t('skills.detail.requires')}</h3>
            <DetailList values={enrichment.required.requires} />
          </section>
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold">{t('skills.detail.bestFor')}</h3>
            <DetailList values={enrichment.required.bestFor} />
          </section>
          <Separator />
          <section className="flex flex-col gap-3">
            <div>
              <h3 className="text-sm font-semibold">{t('skills.detail.related')}</h3>
              <p className="text-muted-foreground text-xs">
                {t('skills.detail.relatedDescription')}
              </p>
            </div>
            {(query.data?.related ?? []).length > 0 ? (
              <div className="flex flex-col gap-2">
                {(query.data?.related ?? []).map((related) => (
                  <Button
                    key={related.skillId}
                    variant="outline"
                    className="h-auto justify-between gap-3 px-3 py-2 text-start"
                    onClick={() => setSkill(skillStubFromId(related.skillId))}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium capitalize">
                        {titleForSkill(related.skillId)}
                      </span>
                      <span className="text-muted-foreground block truncate text-xs">
                        {related.skillId}
                      </span>
                    </span>
                    <Badge variant="secondary" className="shrink-0 tabular-nums">
                      {Math.round(related.score * 100)}%
                    </Badge>
                  </Button>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{t('skills.detail.noRelated')}</p>
            )}
          </section>
          <div className="flex justify-end border-t pt-4">
            <Button variant="outline" onClick={() => void platform.openExternal(skill.url)}>
              <ExternalLink data-icon="inline-start" />
              {t('skills.detail.openExternal')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 py-4">
          <p className="text-muted-foreground text-sm text-pretty">
            {t('skills.detail.noEnrichment')}
          </p>
          <Button
            variant="outline"
            className="w-fit"
            onClick={() => void platform.openExternal(skill.url)}
          >
            <ExternalLink data-icon="inline-start" />
            {t('skills.detail.openExternal')}
          </Button>
        </div>
      )}
    </div>
  );
}
