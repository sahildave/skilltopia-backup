import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { InstalledScanSnapshot, ScannedSkill } from '@/platform/types';
import { useTranslation } from 'react-i18next';
import { providerBadgesForSkill } from './installed-skills-model';

export function SkillProviderBadges({
  skill,
  snapshot,
}: {
  skill: ScannedSkill;
  snapshot: InstalledScanSnapshot;
}) {
  const { t } = useTranslation();
  const badges = providerBadgesForSkill(skill, snapshot);

  return (
    <div className="flex flex-wrap gap-1.5">
      {badges.map((badge) => {
        if (badge.kind === 'universal') {
          return (
            <Badge key="universal" variant="outline" size="sm">
              {t('skills.installed.universal')}
            </Badge>
          );
        }

        if (badge.kind === 'project') {
          return (
            <Badge key="project" variant="outline" size="sm">
              {t('skills.projects.agentsBadge')}
            </Badge>
          );
        }

        if (badge.kind === 'location') {
          return (
            <Badge key={`location-${badge.label}`} variant="outline" size="sm">
              {badge.label}
            </Badge>
          );
        }

        const label = t('skills.installed.providersBadge', { count: badge.count });
        const tooltipText = badge.names.join('\n');

        return (
          <Tooltip key="providers">
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                tabIndex={0}
                size="sm"
                aria-label={`${label}: ${badge.names.join(', ')}`}
              >
                {label}
              </Badge>
            </TooltipTrigger>
            <TooltipContent
              side="top"
              className="max-h-48 overflow-y-auto whitespace-pre-line text-left"
            >
              {tooltipText}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
