import { useState } from 'react';
import { ChevronDown, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { platform } from '@platform';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MorphingDialog,
  MorphingDialogClose,
  MorphingDialogContainer,
  MorphingDialogContent,
  MorphingDialogSubtitle,
  MorphingDialogTitle,
  MorphingDialogTrigger,
} from '@/components/ui/morphing-dialog';
import type { SkillsShSkill } from '@/catalog/types';
import { isInstallCancelled, isPermissionError } from './library-errors';
import { SkillDetailBody } from './SkillDetailDialog';
import type { InstallScope } from './types';

const MORPH_TRANSITION = { type: 'spring', stiffness: 200, damping: 24 } as const;

const DETAIL_CONTENT_CLASS =
  'app-material-strong bg-background relative max-h-[85vh] w-full max-w-[calc(100%-2rem)] overflow-y-auto rounded-lg border p-6 shadow-lg sm:max-w-2xl';

export function formatInstalls(count: number): string {
  return new Intl.NumberFormat(undefined, { notation: 'compact' }).format(count);
}

export function SkillInstallMenu({ skill }: { skill: SkillsShSkill }) {
  const { t } = useTranslation();
  const [installing, setInstalling] = useState(false);
  const copiesCommand = platform.copiesInstallCommand;

  const handleInstall = async (scope: InstallScope) => {
    setInstalling(true);
    try {
      await platform.install(
        {
          id: skill.id,
          name: skill.name,
          installUrl: skill.installUrl,
        },
        scope,
      );
      toast.success(
        t(copiesCommand ? 'skills.install.copied' : 'skills.install.success', {
          name: skill.name,
        }),
      );
    } catch (error) {
      if (isInstallCancelled(error)) return;
      const message = error instanceof Error ? error.message : String(error);
      if (isPermissionError(message)) {
        toast.error(t('skills.install.permissionError'), {
          description: message,
        });
      } else {
        toast.error(
          t(copiesCommand ? 'skills.install.copyFailed' : 'skills.install.failed', {
            name: skill.name,
          }),
          { description: message },
        );
      }
    } finally {
      setInstalling(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={installing}>
          {t(copiesCommand ? 'skills.install.copyAction' : 'skills.install.action')}
          <ChevronDown size={16} data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled={installing} onSelect={() => void handleInstall('global')}>
          {t(copiesCommand ? 'skills.install.copyGlobal' : 'skills.install.global')}
        </DropdownMenuItem>
        <DropdownMenuItem disabled={installing} onSelect={() => void handleInstall('project')}>
          {t(copiesCommand ? 'skills.install.copyProject' : 'skills.install.project')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CatalogSkillCard({
  skill,
  compact = false,
}: {
  skill: SkillsShSkill;
  compact?: boolean;
}) {
  const { t } = useTranslation();

  return (
    <MorphingDialog transition={MORPH_TRANSITION}>
      <MorphingDialogTrigger
        asChild
        className={compact ? 'w-75 max-w-75 shrink-0' : undefined}
      >
        <div>
          <Card className="gap-4 overflow-hidden py-4 hover:ring-5 hover:ring-primary/20 hover:outline-0.5 hover:outline-primary/80">
            <CardHeader className="px-4">
              <div className="flex items-start justify-between gap-2 text-base">
                <MorphingDialogTitle className="truncate text-balance line-clamp-1 font-semibold leading-none">
                  {skill.name}
                </MorphingDialogTitle>
                <Badge variant="secondary" className="shrink-0 tabular-nums">
                  {formatInstalls(skill.installs)}
                </Badge>
              </div>
              <MorphingDialogSubtitle className="text-muted-foreground truncate text-sm text-pretty">
                {skill.source}
              </MorphingDialogSubtitle>
            </CardHeader>
            <CardContent className="px-4">
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline">{skill.sourceType}</Badge>
                <Badge variant="outline" className="max-w-full truncate">
                  {skill.slug}
                </Badge>
              </div>
            </CardContent>
            <CardFooter
              className="flex-wrap justify-end gap-1 border-t px-4 pt-4"
              onClick={(event) => event.stopPropagation()}
              onKeyDown={(event) => event.stopPropagation()}
            >
              <SkillInstallMenu skill={skill} />
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
      </MorphingDialogTrigger>
      <MorphingDialogContainer>
        <MorphingDialogContent className={DETAIL_CONTENT_CLASS}>
          <SkillDetailBody skill={skill} />
          <MorphingDialogClose />
        </MorphingDialogContent>
      </MorphingDialogContainer>
    </MorphingDialog>
  );
}

export function CatalogSkillListRow({ skill }: { skill: SkillsShSkill }) {
  const { t } = useTranslation();

  return (
    <MorphingDialog transition={MORPH_TRANSITION}>
      <div
        data-slot="catalog-skill-list-row"
        className="flex items-center gap-3 border-b border-border/60 py-3 last:border-b-0"
      >
        <div className="min-w-0 flex-1">
          <MorphingDialogTitle className="truncate text-sm font-semibold">
            {skill.name}
          </MorphingDialogTitle>
          <MorphingDialogSubtitle className="text-muted-foreground truncate text-xs text-pretty">
            {skill.source}
          </MorphingDialogSubtitle>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="secondary" className="tabular-nums">
            {formatInstalls(skill.installs)}
          </Badge>
          <Badge variant="outline">{skill.sourceType}</Badge>
          <SkillInstallMenu skill={skill} />
          <MorphingDialogTrigger asChild>
            <Button variant="outline" size="sm">
              {t('skills.dashboard.details')}
            </Button>
          </MorphingDialogTrigger>
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
        </div>
      </div>
      <MorphingDialogContainer>
        <MorphingDialogContent className={DETAIL_CONTENT_CLASS}>
          <SkillDetailBody skill={skill} />
          <MorphingDialogClose />
        </MorphingDialogContent>
      </MorphingDialogContainer>
    </MorphingDialog>
  );
}
