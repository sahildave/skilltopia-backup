/** Shared morphing-dialog chrome for every skill detail surface (catalog + installed). */

/**
 * An eased tween, not a spring: the underdamped spring this replaced overshot,
 * so shared title/subtitle text blew past its final size before settling back.
 */
export const MORPH_TRANSITION = { type: 'tween', duration: 0.3, ease: 'easeOut' } as const;

export const DETAIL_CONTENT_CLASS =
  'app-material-strong bg-background relative max-h-[85vh] w-full max-w-[calc(100%-2rem)] overflow-y-auto rounded-[min(var(--radius-4xl),24px)] border p-6 scrollbar-none shadow-lg sm:max-w-2xl';
