import { Badge } from '@/components/ui/badge';
import { useSkillCategories } from '@/hooks/use-skill-categories';
import { cn } from '@/lib/utils';
import { SKILL_CHIP_TEXT_CLASS } from './skill-chip';

/**
 * Category pills for one skill, in the order the enrichment stored them — the
 * primary category first. Slugs outside the taxonomy are dropped.
 */
export function SkillCategoryPills({
  categories,
  className,
}: {
  categories: readonly string[];
  className?: string;
}) {
  const bindings = useSkillCategories();
  const byKey = new Map(bindings.map((binding) => [binding.key as string, binding]));
  const matched = categories
    .map((category) => byKey.get(category))
    .filter((binding) => binding !== undefined);

  if (matched.length === 0) return null;

  return (
    <div
      data-slot="skill-category-pills"
      className={cn('flex min-w-0 flex-wrap items-center gap-1', className)}
    >
      {matched.map(({ key, icon: Icon, label }) => (
        <Badge
          key={key}
          data-category={key}
          variant="secondary"
          size="sm"
          className={cn(SKILL_CHIP_TEXT_CLASS, 'inline-flex items-center gap-1 px-1.5')}
        >
          <Icon aria-hidden />
          <span className="truncate">{label}</span>
        </Badge>
      ))}
    </div>
  );
}
