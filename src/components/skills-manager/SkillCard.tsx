import { Button } from '@/components/ui/button';
import type { InstalledScanSnapshot, ScannedSkill } from '@/platform/types';
import { Check } from 'lucide-react';
import { useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { ProviderFilterId } from './installed-skills-model';
import { SkillCardOverflowMenu } from './SkillCardOverflowMenu';
import { SkillProviderBadges } from './SkillProviderBadges';
import { SkillSurfaceCard } from './SkillSurfaceCard';

export function SkillCard({
  skill,
  snapshot,
  providerFilter,
}: {
  skill: ScannedSkill;
  snapshot: InstalledScanSnapshot;
  providerFilter: ProviderFilterId;
}) {
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <SkillSurfaceCard
      title={
        <div className="truncate text-balance line-clamp-1 font-semibold leading-normal">
          {skill.name}
        </div>
      }
      subtitle={
        <div className="text-muted-foreground line-clamp-2 text-sm text-pretty">
          {skill.description}
        </div>
      }
      headerTrailing={
        <SkillCardOverflowMenu
          skill={skill}
          snapshot={snapshot}
          providerFilter={providerFilter}
          reduceMotion={reduceMotion}
        />
      }
      footerLeading={<SkillProviderBadges skill={skill} snapshot={snapshot} />}
      footerTrailing={
        <Button
          variant="outline"
          size="sm"
          className="text-teal-700 dark:text-teal-500 bg-transparent shadow-none border-none pointer-events-none"
        >
          <Check size={16} data-icon="inline-end" />
          {t('skills.installed.cardInstalled')}
        </Button>
      }
    />
  );
}
