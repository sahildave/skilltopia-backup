import { isPassAuditStatus, type SkillAuditEntry, type SkillsShSkill } from '@/catalog/types';
import { Sparkline } from '@/components/dither-kit';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MorphingDialogSubtitle, MorphingDialogTitle } from '@/components/ui/morphing-dialog';
import { Separator } from '@/components/ui/separator';
import { useSkillAudits, useSkillDetail } from '@/services/skills-sh';
import { platform } from '@platform';
import { AlertCircle, ExternalLink, LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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

function AuditStatusBadge({ status }: { status: SkillAuditEntry['status'] }) {
  const variant = isPassAuditStatus(status) ? 'secondary' : 'outline';
  return (
    <Badge variant={variant} className="capitalize">
      {status}
    </Badge>
  );
}

function AuditsSection({
  audits,
  isLoading,
  error,
}: {
  audits: SkillAuditEntry[] | undefined;
  isLoading: boolean;
  error: Error | null;
}) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <LoaderCircle className="size-4 animate-spin" />
        {t('skills.detail.auditsLoading')}
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>{t('skills.detail.auditsFailed')}</AlertTitle>
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  if (!audits || audits.length === 0) {
    return <p className="text-muted-foreground text-sm">{t('skills.detail.noAudits')}</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {audits.map((audit) => (
        <li
          key={`${audit.provider}-${audit.slug}-${audit.auditedAt}`}
          className="rounded-lg border bg-muted/30 px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium">{audit.provider}</span>
            <AuditStatusBadge status={audit.status} />
          </div>
          <p className="text-muted-foreground mt-1 text-sm text-pretty">{audit.summary}</p>
        </li>
      ))}
    </ul>
  );
}

/** Detail panel body for MorphingDialog — page cache + on-demand audits. */
export function SkillDetailBody({ skill }: { skill: SkillsShSkill }) {
  const { t } = useTranslation();
  const detailQuery = useSkillDetail(skill.id);
  const auditsQuery = useSkillAudits(skill.id);

  const detail = detailQuery.data;
  const pageSnapshot = detail?.pageSnapshot ?? null;
  const installCount = detail?.installCount ?? skill.installs;
  const repository = detail?.repository ?? pageSnapshot?.repository ?? null;
  const source = detail?.source ?? pageSnapshot?.source ?? null;
  const originLabel = repository
    ? t('skills.detail.repository')
    : source
      ? t('skills.detail.source')
      : null;
  const originValue = repository ?? source;
  const originHref = repository
    ? `https://github.com/${repository}`
    : source
      ? /^https?:\/\//iu.test(source)
        ? source
        : `https://${source}`
      : null;
  const installSeries = detail?.installSeries ?? [];
  const topics = pageSnapshot?.topics ?? [];
  const summary = pageSnapshot?.summary;
  const auditEntries = auditsQuery.data?.audits?.audits;

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

      {detailQuery.isLoading ? (
        <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
          <LoaderCircle className="size-4 animate-spin" />
          {t('skills.detail.loading')}
        </div>
      ) : detailQuery.error ? (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>{t('skills.detail.loadFailed')}</AlertTitle>
          <AlertDescription>
            {detailQuery.error instanceof Error
              ? detailQuery.error.message
              : String(detailQuery.error)}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="flex flex-col gap-5">
          {summary ? (
            <section className="rounded-lg border bg-muted/30 p-4">
              <h3 className="text-sm font-semibold">{t('skills.detail.summary')}</h3>
              <p className="text-muted-foreground mt-2 text-sm text-pretty">{summary}</p>
            </section>
          ) : null}

          {topics.length > 0 ? (
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{t('skills.detail.topics')}</h3>
              <DetailList values={topics} />
            </section>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold">{t('skills.detail.installs')}</h3>
              <p className="text-muted-foreground text-sm tabular-nums">
                {installCount.toLocaleString()}
              </p>
              {installSeries.length > 0 ? (
                <div className="h-12 w-full">
                  <Sparkline data={installSeries} color="blue" className="h-12 w-full" />
                </div>
              ) : null}
            </section>
            {originLabel && originValue ? (
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">{originLabel}</h3>
                {originHref ? (
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground text-start text-sm break-all underline-offset-2 hover:underline"
                    onClick={() => void platform.openExternal(originHref)}
                  >
                    {originValue}
                  </button>
                ) : (
                  <p className="text-muted-foreground text-sm break-all">{originValue}</p>
                )}
              </section>
            ) : null}
          </div>

          <Separator />

          <section className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold">{t('skills.detail.audits')}</h3>
            <AuditsSection
              audits={auditEntries}
              isLoading={auditsQuery.isLoading}
              error={
                auditsQuery.error instanceof Error
                  ? auditsQuery.error
                  : auditsQuery.error
                    ? new Error(String(auditsQuery.error))
                    : null
              }
            />
          </section>

          <div className="flex justify-end border-t pt-4">
            <Button variant="outline" onClick={() => void platform.openExternal(skill.url)}>
              <ExternalLink data-icon="inline-start" />
              {t('skills.detail.openExternal')}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
