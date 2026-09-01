/** Shared dialog chrome for every skill detail surface (catalog + installed). */

/**
 * Overrides on the standard DialogContent: wider than the default `sm:max-w-lg`
 * and internally scrollable, with the scrollbar hidden. DialogContent already
 * supplies the material, border, radius, padding, and shadow.
 */
export const DETAIL_CONTENT_CLASS =
  'max-h-[95vh] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:max-w-2xl';
