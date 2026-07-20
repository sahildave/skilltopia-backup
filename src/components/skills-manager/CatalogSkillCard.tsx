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
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { SkillsShSkill } from '@/catalog/types';
import { isInstallCancelled, isPermissionError } from './library-errors';
import type { InstallScope } from './types';

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
  onOpen,
}: {
  skill: SkillsShSkill;
  compact?: boolean;
  onOpen: (skill: SkillsShSkill) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className={compact ? 'w-75 max-w-75 shrink-0' : undefined}>
      <Card className="gap-4 overflow-hidden py-4">
        <CardHeader className="px-4">
          <CardTitle className="flex items-start justify-between gap-2 text-base">
            <span className="truncate text-balance line-clamp-1">{skill.name}</span>
            <Badge variant="secondary" className="shrink-0 tabular-nums">
              {formatInstalls(skill.installs)}
            </Badge>
          </CardTitle>
          <CardDescription className="truncate text-pretty">{skill.source}</CardDescription>
        </CardHeader>
        <CardContent className="px-4">
          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline">{skill.sourceType}</Badge>
            <Badge variant="outline" className="max-w-full truncate">
              {skill.slug}
            </Badge>
          </div>
        </CardContent>
        <CardFooter className="flex-wrap justify-end gap-1 border-t px-4 pt-4">
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
  );
}

export function CatalogSkillListRow({
  skill,
  onOpen,
}: {
  skill: SkillsShSkill;
  onOpen: (skill: SkillsShSkill) => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      data-slot="catalog-skill-list-row"
      className="flex items-center gap-3 border-b border-border/60 py-3 last:border-b-0"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{skill.name}</p>
        <p className="text-muted-foreground truncate text-xs text-pretty">{skill.source}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant="secondary" className="tabular-nums">
          {formatInstalls(skill.installs)}
        </Badge>
        <Badge variant="outline">{skill.sourceType}</Badge>
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
      </div>
    </div>
  );
}
