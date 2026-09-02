import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

/** Scroll offset that collapses the header. */
const COLLAPSE_AT = 48;
/** Offset the scroller must return to before the header expands again. */
const EXPAND_AT = 8;

/**
 * Drives a header that floats above its scroll area. The header is out of flow,
 * so collapsing it never resizes the viewport and scrolling stays smooth at any
 * speed; the list instead reserves `headerHeight` of top padding, measured from
 * the header's expanded layout.
 */
export function useCollapsibleHeader(): {
  viewportRef: RefObject<HTMLDivElement | null>;
  collapsed: boolean;
  headerHeight: number | undefined;
  onExpandedHeightChange: (height: number) => void;
} {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [headerHeight, setHeaderHeight] = useState<number>();

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    let frame: number | null = null;

    const read = () => {
      frame = null;
      const offset = viewport.scrollTop;
      setCollapsed((current) => (current ? offset > EXPAND_AT : offset > COLLAPSE_AT));
    };

    const sync = () => {
      frame ??= requestAnimationFrame(read);
    };

    read();
    viewport.addEventListener('scroll', sync, { passive: true });
    return () => {
      if (frame !== null) cancelAnimationFrame(frame);
      viewport.removeEventListener('scroll', sync);
    };
  }, []);

  const onExpandedHeightChange = useCallback((height: number) => setHeaderHeight(height), []);

  return { viewportRef, collapsed, headerHeight, onExpandedHeightChange };
}
