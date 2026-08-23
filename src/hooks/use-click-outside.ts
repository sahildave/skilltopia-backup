import { useEffect, useRef, type RefObject } from 'react';

/**
 * Radix portals menu/select/popover content to <body>, and sonner portals toasts,
 * so a pointer event on a menu item is geometrically outside `ref` while being
 * logically inside it. Without this, opening a menu inside a dismissable surface
 * dismisses that surface and unmounts the menu before it can act.
 */
const PORTALED_LAYER_SELECTOR =
  '[data-radix-popper-content-wrapper], [role="menu"], [role="listbox"], [data-sonner-toaster]';

/**
 * Calls `handler` when a pointer event lands outside `ref`, ignoring portaled
 * overlay layers (menus, popovers, toasts) that belong to content inside `ref`.
 */
export function useClickOutside<T extends HTMLElement>(
  ref: RefObject<T | null>,
  handler: () => void,
) {
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  });

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const el = ref.current;
      const target = event.target as Node | null;
      if (!el || !target || el.contains(target)) return;
      if (target instanceof Element && target.closest(PORTALED_LAYER_SELECTOR)) return;
      handlerRef.current();
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [ref]);
}
