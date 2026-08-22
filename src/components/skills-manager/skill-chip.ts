// Footer chips on skill cards are icon-first: a 28px circle for a single-concept
// badge (plugin, Universal) and a pill for the "+N providers" count.
export const SKILL_CHIP_ICON_CLASS =
  'size-7 justify-center rounded-full p-0 [&>svg]:size-4 text-muted-foreground';

export const SKILL_CHIP_TEXT_CLASS =
  'h-7 rounded-[10px] px-2 text-[11px] leading-[14px] font-medium text-muted-foreground';

// The dark theme's install action is a solid black pill; light mode keeps the
// outline button so the card stays legible on a white surface.
export const SKILL_ACTION_PILL_CLASS =
  'dark:border-transparent dark:bg-black dark:shadow-xs dark:hover:bg-black/80';
