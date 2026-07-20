import { Badge } from '@/components/ui/badge';
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
import { providerTagsForSkill, type ProviderFilterId } from './installed-skills-model';
import { SkillCardOverflowMenu } from './SkillCardOverflowMenu';

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
          <CardTitle className="truncate text-sm">{skill.name}</CardTitle>
          <SkillCardOverflowMenu
            skill={skill}
            providerFilter={providerFilter}
            reduceMotion={reduceMotion}
          />
        </div>
        <CardDescription className="line-clamp-2 text-pretty">{skill.description}</CardDescription>
      </CardHeader>
      <CardContent className="px-4">
        <div className="flex flex-wrap gap-1.5">
          {providerTagsForSkill(skill, snapshot).map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      </CardContent>
      <CardFooter className="text-muted-foreground justify-between border-t px-4 pt-4 text-xs">
        <span>{skill.scope}</span>
        <span>{t('skills.installed.cardInstalled')}</span>
      </CardFooter>
    </Card>
  );
}
