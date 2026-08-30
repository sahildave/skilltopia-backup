import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useSkillCategories } from '@/hooks/use-skill-categories';
import { cn } from '@/lib/utils';
import { Check, ListFilter } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { SkillCategory } from '../../../api/_lib/taxonomy';

/** Multi-select facet over the skill taxonomy. Selection order is preserved. */
export function SkillCategoryFilter({
  selected,
  onChange,
}: {
  selected: SkillCategory[];
  onChange: (categories: SkillCategory[]) => void;
}) {
  const { t } = useTranslation();
  const bindings = useSkillCategories();
  const [open, setOpen] = useState(false);
  const selectedKeys = new Set(selected);

  const toggle = (key: SkillCategory) => {
    onChange(
      selectedKeys.has(key) ? selected.filter((category) => category !== key) : [...selected, key],
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <ListFilter data-icon="inline-start" />
          {t('skills.dashboard.categoryFilter')}
          {selected.length ? (
            <Badge variant="secondary" size="sm" className="tabular-nums">
              {selected.length}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command>
          <CommandInput placeholder={t('skills.dashboard.categorySearch')} />
          <CommandList>
            <CommandEmpty>{t('skills.dashboard.noCategories')}</CommandEmpty>
            <CommandGroup>
              {bindings.map(({ key, icon: Icon, label }) => (
                <CommandItem key={key} value={label} onSelect={() => toggle(key)}>
                  <Check
                    className={cn('size-4', selectedKeys.has(key) ? 'opacity-100' : 'opacity-0')}
                  />
                  <Icon aria-hidden />
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {selected.length ? (
            <div className="border-t p-1">
              <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange([])}>
                {t('skills.dashboard.clearCategories')}
              </Button>
            </div>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
