import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useEffect, useRef, type Ref } from 'react';

import { Button } from '@/components/ui/button';
import { popoverPanelVariants } from '@/lib/animation';
import { cn } from '@/lib/utils';

interface UseActionMenuDismissOptions {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function useActionMenuDismiss({ open, onOpenChange }: UseActionMenuDismissOptions) {
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => onOpenChange(false), [onOpenChange]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) {
        close();
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        close();
      }
    }

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  return { ref, close };
}

interface ActionMenuRootProps {
  ref?: Ref<HTMLDivElement>;
  open?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function ActionMenuRoot({ ref, open = false, children, className }: ActionMenuRootProps) {
  return (
    <div
      ref={ref}
      className={cn('relative shrink-0', open && 'z-10 pointer-events-auto', className)}
    >
      {children}
    </div>
  );
}

interface ActionMenuPanelProps {
  open: boolean;
  align?: 'left' | 'right';
  className?: string;
  children: React.ReactNode;
}

export function ActionMenuPanel({
  open,
  align = 'right',
  className,
  children,
}: ActionMenuPanelProps) {
  const reduceMotion = useReducedMotion();
  const menuVariants = popoverPanelVariants(Boolean(reduceMotion));

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="action-menu-panel"
          variants={menuVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          style={{ transformOrigin: align === 'right' ? 'top right' : 'top left' }}
          role="menu"
          className={cn(
            'pointer-events-auto absolute top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-lg sm:w-[220px]',
            align === 'right' ? 'right-0' : 'left-0',
            className,
          )}
        >
          {children}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

interface ActionMenuHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function ActionMenuHeader({ children, className }: ActionMenuHeaderProps) {
  return (
    <div className={cn('border-b border-border bg-muted/50 p-4', className)}>
      <span className="text-sm font-medium text-balance text-muted-foreground">{children}</span>
    </div>
  );
}

interface ActionMenuContentProps {
  children: React.ReactNode;
  className?: string;
}

export function ActionMenuContent({ children, className }: ActionMenuContentProps) {
  return <div className={cn('flex flex-col px-2 py-2', className)}>{children}</div>;
}

interface ActionMenuItemProps {
  icon?: React.ReactNode;
  label: string;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
  destructive?: boolean;
}

export function ActionMenuItem({
  icon,
  label,
  onClick,
  className,
  disabled = false,
  destructive = false,
}: ActionMenuItemProps) {
  const itemClassName = cn(
    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm font-medium transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50',
    "data-[variant=destructive]:*:[svg]:!text-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    destructive ? 'text-destructive' : 'text-foreground',
    className,
  );

  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      disabled={disabled}
      className={itemClassName}
    >
      {icon ? <span>{icon}</span> : null}
      <span className="text-pretty">{label}</span>
    </button>
  );
}

type ActionMenuTriggerProps = React.ComponentProps<typeof Button>;

export function ActionMenuTrigger({
  className,
  variant = 'secondary',
  size = 'icon-sm',
  'aria-expanded': ariaExpanded,
  'aria-haspopup': ariaHaspopup = 'menu',
  ...props
}: ActionMenuTriggerProps) {
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      aria-expanded={ariaExpanded}
      aria-haspopup={ariaHaspopup}
      className={className}
      {...props}
    />
  );
}
