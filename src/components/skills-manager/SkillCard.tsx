import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { InstalledScanSnapshot, ScannedSkill } from '@/platform/types';
import { useReducedMotion } from 'motion/react';
import { useTranslation } from 'react-i18next';
import type { ProviderFilterId } from './installed-skills-model';
import { SkillCardOverflowMenu } from './SkillCardOverflowMenu';
import { SkillProviderBadges } from './SkillProviderBadges';

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
    <Card className="gap-4 py-4">
      <CardHeader className="px-4">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="truncate text-balance line-clamp-1 font-semibold leading-normal">
            {skill.name}
          </CardTitle>
          <SkillCardOverflowMenu
            skill={skill}
            snapshot={snapshot}
            providerFilter={providerFilter}
            reduceMotion={reduceMotion}
          />
        </div>
        <CardDescription className="line-clamp-2 text-pretty">{skill.description}</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <SkillProviderBadges skill={skill} snapshot={snapshot} />
      </CardContent>
      <CardFooter className="text-muted-foreground justify-between border-t px-5! pt-4! text-xs">
        <span>{skill.scope}</span>
        <span className="font-semibold text-teal-700 dark:text-teal-400/50">
          {t('skills.installed.cardInstalled')}
        </span>
      </CardFooter>
    </Card>
  );
}
