'use client';

import type { LucideIcon } from 'lucide-react';
import { LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { useId, useState, type ReactNode } from 'react';

import { BadgeWithHelp } from '@/components/ui/badge-with-help';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

export interface ContinuousTabItem {
  id: string;
  /** Visible label. Omit for icon-only tabs. */
  label?: string;
  icon?: LucideIcon;
  /**
   * Accessible name. Defaults to `label`.
   * Required when `label` is omitted (icon-only).
   */
  ariaLabel?: string;
  /** Help tooltip shown via BadgeWithHelp only while this tab is active. */
  helpTooltip?: string;
}

interface ContinuousTabsProps {
  tabs?: ContinuousTabItem[];
  defaultActiveId?: string;
  /** Controlled active tab; when set, overrides internal state. */
  value?: string;
  onChange?: (id: string) => void;
  className?: string;
}

const PILL_TRANSITION = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 30,
  mass: 0.9,
};

function tabAccessibleName(tab: ContinuousTabItem): string {
  return tab.ariaLabel ?? tab.label ?? tab.id;
}

function TabContent({ tab, isActive }: { tab: ContinuousTabItem; isActive: boolean }) {
  const Icon = tab.icon;
  const showLabel = Boolean(tab.label);
  const nodes: ReactNode[] = [];

  if (Icon) {
    nodes.push(<Icon key="icon" aria-hidden />);
  }
  if (showLabel && tab.label) {
    nodes.push(
      <span key="label" className="text-sm font-medium">
        {tab.label}
      </span>,
    );
  }
  if (isActive && tab.helpTooltip) {
    nodes.push(
      <BadgeWithHelp
        key="help"
        tooltip={tab.helpTooltip}
        className="border-primary-foreground/25 bg-primary-foreground/15 text-primary-foreground"
      />,
    );
  }

  return <span className="relative z-10 inline-flex items-center gap-1.5">{nodes}</span>;
}

export function ContinuousTabs({
  tabs = [],
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
          'relative gap-0.5 rounded-full border border-border bg-background p-1 shadow-none',
          className,
        )}
      >
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          const iconOnly = Boolean(tab.icon) && !tab.label;

          return (
            <ToggleGroupItem
              key={tab.id}
              value={tab.id}
              aria-label={tabAccessibleName(tab)}
              size="sm"
              className={cn(
                'relative min-w-0 flex-none rounded-full shadow-none',
                'border-0 bg-transparent hover:bg-transparent',
                'first:rounded-full last:rounded-full',
                'data-[state=on]:bg-transparent data-[state=on]:text-primary-foreground',
                'data-[state=off]:text-muted-foreground data-[state=off]:hover:text-foreground',
                iconOnly ? 'px-2' : 'px-3',
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
              <TabContent tab={tab} isActive={isActive} />
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
    </LayoutGroup>
  );
}
