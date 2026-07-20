'use client';

import { LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { useId, useState } from 'react';

import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

interface TabItem {
  id: string;
  label: string;
}

interface ContinuousTabsProps {
  tabs?: TabItem[];
  defaultActiveId?: string;
  /** Controlled active tab; when set, overrides internal state. */
  value?: string;
  onChange?: (id: string) => void;
  className?: string;
}

const DEFAULT_TABS: TabItem[] = [
  { id: 'list', label: 'List' },
  { id: 'grid', label: 'Grid' },
];

const PILL_TRANSITION = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 30,
  mass: 0.9,
};

export function ContinuousTabs({
  tabs = DEFAULT_TABS,
  defaultActiveId = 'grid',
  value,
  onChange,
  className,
}: ContinuousTabsProps) {
  const [uncontrolledActive, setUncontrolledActive] = useState(defaultActiveId);
  const active = value ?? uncontrolledActive;
  const reduceMotion = useReducedMotion() ?? false;
  const pillLayoutId = `continuous-tabs-pill-${useId()}`;

  const handleChange = (id: string) => {
    if (!id) return;
    if (value === undefined) {
      setUncontrolledActive(id);
    }
    onChange?.(id);
  };

  return (
    <LayoutGroup>
      <ToggleGroup
        type="single"
        value={active}
        size="sm"
        onValueChange={handleChange}
        className={cn(
          'relative gap-0.5 rounded-full border border-border bg-muted p-1 shadow-none',
          className,
        )}
      >
        {tabs.map((tab) => {
          const isActive = active === tab.id;

          return (
            <ToggleGroupItem
              key={tab.id}
              value={tab.id}
              aria-label={tab.label}
              size="sm"
              className={cn(
                'relative min-w-0 flex-none rounded-full shadow-none',
                'border-0 bg-transparent hover:bg-transparent',
                'first:rounded-full last:rounded-full',
                'data-[state=on]:bg-transparent data-[state=on]:text-primary-foreground',
                'data-[state=off]:text-muted-foreground data-[state=off]:hover:text-foreground',
              )}
            >
              {isActive ? (
                reduceMotion ? (
                  <div className="absolute inset-0 rounded-full bg-primary" />
                ) : (
                  <motion.div
                    layoutId={pillLayoutId}
                    transition={PILL_TRANSITION}
                    className="absolute inset-0 rounded-full bg-primary shadow-xs"
                  />
                )
              ) : null}
              <span className="relative z-10 text-sm font-medium">{tab.label}</span>
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </LayoutGroup>
  );
}
