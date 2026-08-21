import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { InstalledScanSnapshot, ScannedSkill } from '@/platform/types';
import { Puzzle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { pluginOriginLabel, providerBadgesForSkill } from './installed-skills-model';

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

        if (badge.kind === 'plugin') {
          const label = pluginOriginLabel(badge);
          return (
            <Tooltip key={`plugin-${label}`}>
              <TooltipTrigger asChild>
                <Badge
                  variant="secondary"
                  tabIndex={0}
                  size="sm"
                  aria-label={t('skills.installed.pluginBadgeLabel', { plugin: label })}
                >
                  <Puzzle aria-hidden />
                  {badge.plugin}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="whitespace-pre-line text-start">
                {t('skills.installed.pluginBadgeTooltip', {
                  plugin: label,
                  version: badge.version || t('skills.installed.pluginVersionUnknown'),
                })}
              </TooltipContent>
            </Tooltip>
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
