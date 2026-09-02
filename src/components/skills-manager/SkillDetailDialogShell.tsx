import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useCallback, useState, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { DETAIL_CONTENT_CLASS } from './skill-detail-chrome';
import { SkillDetailDialogCloseContext } from './skill-detail-dialog-close';

const NESTED_INTERACTIVE_SELECTOR =
  'button, a, input, textarea, select, [role="menuitem"], [role="option"]';

/** A click on a nested control (menu, install button) must not open the detail dialog. */
function isNestedInteractiveTarget(target: EventTarget | null, currentTarget: EventTarget | null) {
  if (!(target instanceof Element) || !(currentTarget instanceof Element)) {
    return false;
  }
  const interactive = target.closest(NESTED_INTERACTIVE_SELECTOR);
  return interactive != null && interactive !== currentTarget;
}

/**
 * Wraps a skill card/row so clicking it (but not its nested controls) opens the
 * skill detail in a standard modal dialog.
 */
export function SkillDetailDialogShell({
  trigger,
  children,
}: {
  trigger: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/*
        A plain clickable wrapper, not role="button": giving it a button role
        would fold the whole card's text (install state included) into one
        accessible name and shadow the real controls inside it. The card's own
        buttons stay keyboard-reachable; this only adds click-to-open.
      */}
      <div
        aria-haspopup="dialog"
        aria-expanded={open}
        className="relative cursor-pointer text-start"
        onClick={(event: ReactMouseEvent) => {
          if (isNestedInteractiveTarget(event.target, event.currentTarget)) return;
          setOpen(true);
        }}
      >
        {trigger}
      </div>
      <DialogContent className={DETAIL_CONTENT_CLASS} aria-describedby={undefined}>
        <SkillDetailDialogCloseContext.Provider value={close}>
          {children}
        </SkillDetailDialogCloseContext.Provider>
      </DialogContent>
    </Dialog>
  );
}
