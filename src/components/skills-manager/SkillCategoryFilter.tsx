import { Badge } from '@/components/ui/badge';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useSkillCategories } from '@/hooks/use-skill-categories';
import { cn } from '@/lib/utils';
import { Layers3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { SkillCategory } from '../../../api/_lib/taxonomy';
import type { SkillCategoryCounts } from './skill-category-model';

const ALL_CATEGORY_ID = 'all';

/** Two-row, horizontally scrollable single-select category rail for Explore. */
export function SkillCategoryRail({
  selected,
  counts,
  totalCount,
  onChange,
}: {
  selected: SkillCategory | null;
  counts: SkillCategoryCounts;
  totalCount: number;
  onChange: (category: SkillCategory | null) => void;
}) {
  const { t } = useTranslation();
  const bindings = useSkillCategories();
  const value = selected ?? ALL_CATEGORY_ID;

  const handleValueChange = (nextValue: string) => {
    if (!nextValue || nextValue === ALL_CATEGORY_ID) {
      onChange(null);
      return;
    }

    const nextCategory = bindings.find((binding) => binding.key === nextValue)?.key;
    onChange(nextCategory ?? null);
  };

  const items = [
    <ToggleGroupItem
      key={ALL_CATEGORY_ID}
      value={ALL_CATEGORY_ID}
      aria-label={t('skills.dashboard.allCategories')}
      className="gap-1.5 rounded-lg px-2.5"
    >
      <Layers3 aria-hidden />
      <span>{t('skills.dashboard.allCategories')}</span>
      <Badge variant="secondary" size="xs" className="tabular-nums">
        {totalCount}
      </Badge>
    </ToggleGroupItem>,
    ...bindings.map(({ key, icon: Icon, label }) => (
      <ToggleGroupItem
        key={key}
        value={key}
        aria-label={`${label} (${counts[key] ?? 0})`}
        className={cn('gap-1.5 rounded-lg px-2.5', selected === key && 'data-[state=on]:bg-accent')}
      >
        <Icon aria-hidden />
        <span>{label}</span>
        <Badge variant="secondary" size="xs" className="tabular-nums">
          {counts[key] ?? 0}
        </Badge>
      </ToggleGroupItem>
    )),
  ];

  // Split row-major into two rows: top row holds the first half in reading order.
  const topCount = Math.ceil(items.length / 2);
  const rows = [items.slice(0, topCount), items.slice(topCount)];

  return (
    <div
      data-testid="skill-category-rail"
      className="min-w-0 px-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden overscroll-x-contain"
      aria-label={t('skills.dashboard.categoryFilterLabel')}
    >
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={handleValueChange}
        aria-label={t('skills.dashboard.categoryFilterLabel')}
        variant="outline"
        size="sm"
        spacing={2}
        className="flex w-max flex-col items-start gap-2 rounded-none bg-transparent p-0"
      >
        {rows.map((row, index) => (
          <div key={index} className="flex w-max flex-row gap-2">
            {row}
          </div>
        ))}
      </ToggleGroup>
    </div>
  );
}

export { ALL_CATEGORY_ID };
