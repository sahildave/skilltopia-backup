import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { isPassAuditStatus, type SkillAuditEntry, type SkillsShSkill } from '@/catalog/types';
import { Sparkline } from '@/components/dither-kit';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MorphingDialogSubtitle, MorphingDialogTitle } from '@/components/ui/morphing-dialog';
import { Separator } from '@/components/ui/separator';
import { opacityTransition, layoutDuration, entranceEase } from '@/lib/animation';
import { useSkillAudits, useSkillDetail } from '@/services/skills-sh';
import { platform } from '@platform';
import { AlertCircle, ExternalLink, LoaderCircle } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
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

/**
 * True height tween via CSS (not Motion). Parent MorphingDialog MotionConfig uses a
 * spring (`type: 'spring'`) that merges into Motion height tweens and kills the ease;
 * layoutId projection on the shell also fights Motion layout/height. CSS transitions
 * retarget from the current height and stay outside that tree.
 */
function AnimateAutoHeight({
  children,
  reduceMotion,
}: {
  children: ReactNode;
  reduceMotion: boolean;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const measuredRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    const shell = shellRef.current;
    const content = contentRef.current;
    if (!shell || !content) return;

    const ease = `cubic-bezier(${entranceEase.join(', ')})`;
    const durationMs = Math.round(layoutDuration * 1000);

    const applyHeight = (next: number, animate: boolean) => {
      if (reduceMotion || !animate) {
        shell.style.transition = 'none';
        shell.style.height = `${next}px`;
        return;
      }

      const from = measuredRef.current ?? next;
      shell.style.transition = 'none';
      shell.style.height = `${from}px`;
      // Force style flush so the browser registers the from-height before easing.
      void shell.offsetHeight;
      shell.style.transition = `height ${durationMs}ms ${ease}`;
      shell.style.height = `${next}px`;
    };

    const update = () => {
      const next = content.offsetHeight;
      if (measuredRef.current === null) {
        measuredRef.current = next;
        applyHeight(next, false);
        return;
      }
      if (measuredRef.current === next) return;
      applyHeight(next, true);
      measuredRef.current = next;
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(content);
    return () => {
      observer.disconnect();
      shell.style.transition = 'none';
      shell.style.height = '';
    };
  }, [reduceMotion]);

  return (
    <div ref={shellRef} style={{ overflow: 'hidden' }}>
      <div ref={contentRef}>{children}</div>
    </div>
  );
}

/** Detail panel body for MorphingDialog — page cache + on-demand audits. */
export function SkillDetailBody({ skill }: { skill: SkillsShSkill }) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion() ?? false;
  const fadeTransition = opacityTransition(reduceMotion);
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
  const detailPhase = detailQuery.isLoading ? 'loading' : detailQuery.error ? 'error' : 'ready';

  return (
    <AnimateAutoHeight reduceMotion={reduceMotion}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 pe-8">
          <MorphingDialogTitle className="text-lg leading-none font-semibold text-balance">
            {skill.name}
          </MorphingDialogTitle>
          <MorphingDialogSubtitle className="text-muted-foreground text-sm text-pretty">
            {skill.id}
          </MorphingDialogSubtitle>
        </div>

        <AnimatePresence mode="popLayout" initial={false}>
          {detailPhase === 'loading' ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: fadeTransition }}
              exit={{ opacity: 0, transition: fadeTransition }}
              className="text-muted-foreground flex items-center gap-2 py-8 text-sm"
            >
              <LoaderCircle className="size-4 animate-spin" />
              {t('skills.detail.loading')}
            </motion.div>
          ) : detailPhase === 'error' ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: fadeTransition }}
              exit={{ opacity: 0, transition: fadeTransition }}
            >
              <Alert variant="destructive">
                <AlertCircle />
                <AlertTitle>{t('skills.detail.loadFailed')}</AlertTitle>
                <AlertDescription>
                  {detailQuery.error instanceof Error
                    ? detailQuery.error.message
                    : String(detailQuery.error)}
                </AlertDescription>
              </Alert>
            </motion.div>
          ) : (
            <motion.div
              key="ready"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: fadeTransition }}
              exit={{ opacity: 0, transition: fadeTransition }}
              className="flex flex-col gap-5"
            >
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
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AnimateAutoHeight>
  );
}
