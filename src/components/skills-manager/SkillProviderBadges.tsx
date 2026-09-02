import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { InstalledScanSnapshot, ScannedSkill } from '@/platform/types';
import { Globe, Puzzle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { pluginOriginLabel, providerBadgesForSkill } from './installed-skills-model';
import { SKILL_CHIP_ICON_CLASS, SKILL_CHIP_TEXT_CLASS } from './skill-chip';

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
    <div className="flex flex-wrap items-center gap-1.5">
      {badges.map((badge) => {
        if (badge.kind === 'universal') {
          const label = t('skills.installed.universal');
          return (
            <Tooltip key="universal">
              <TooltipTrigger asChild>
                <Badge
                  variant="secondary"
                  size="sm"
                  tabIndex={0}
                  aria-label={label}
                  className={SKILL_CHIP_ICON_CLASS}
                >
                  <Globe aria-hidden />
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top">{label}</TooltipContent>
            </Tooltip>
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
                  className={SKILL_CHIP_ICON_CLASS}
                >
                  <Puzzle aria-hidden />
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
        if (badge.kind === 'project') {
          return (
            <Badge key="project" variant="secondary" size="sm" className={SKILL_CHIP_TEXT_CLASS}>
              {t('skills.projects.agentsBadge')}
            </Badge>
          );
        }

        if (badge.kind === 'location') {
          return (
            <Badge
              key={`location-${badge.label}`}
              variant="secondary"
              size="sm"
              className={SKILL_CHIP_TEXT_CLASS}
            >
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
                variant="secondary"
                tabIndex={0}
                size="sm"
                aria-label={`${label}: ${badge.names.join(', ')}`}
                className={SKILL_CHIP_TEXT_CLASS}
              >
                +{badge.count}
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
