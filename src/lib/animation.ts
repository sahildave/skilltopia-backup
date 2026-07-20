export const enterDuration = 0.2
export const exitDuration = 0.15
export const layoutDuration = 0.2
export const staggerDelay = 0.04
export const entranceEase = [0.23, 1, 0.32, 1] as const
export const reducedEnterDuration = 0.12
export const reducedExitDuration = 0.1

export function layoutPositionTransition(reduceMotion: boolean) {
  return {
    layout: reduceMotion
      ? { duration: 0 }
      : { duration: layoutDuration, ease: 'easeOut' as const },
  }
}

function reducedMotionFadeVariants() {
  return {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: reducedEnterDuration } },
    exit: { opacity: 0, transition: { duration: reducedExitDuration } },
  }
}

export function feedListItemVariants(reduceMotion: boolean, index: number) {
  if (reduceMotion) {
    return reducedMotionFadeVariants()
  }

  return {
    initial: { opacity: 0, transform: 'translateY(8px) scale(0.98)' },
    animate: {
      opacity: 1,
      transform: 'translateY(0px) scale(1)',
      transition: {
        duration: enterDuration,
        ease: entranceEase,
        delay: index * staggerDelay,
      },
    },
    exit: {
      opacity: 0,
      transform: 'translateY(-4px) scale(0.98)',
      transition: { duration: exitDuration, ease: entranceEase },
    },
  }
}

export function todoRowVariants(reduceMotion: boolean) {
  if (reduceMotion) {
    return reducedMotionFadeVariants()
  }

  return {
    initial: { opacity: 0, transform: 'translateY(-4px)' },
    animate: {
      opacity: 1,
      transform: 'translateY(0px)',
      transition: { duration: enterDuration, ease: entranceEase },
    },
    exit: {
      opacity: 0,
      transform: 'translateY(-4px)',
      transition: { duration: exitDuration, ease: entranceEase },
    },
  }
}

export function feedEmptyStateVariants(reduceMotion: boolean) {
  if (reduceMotion) {
    return reducedMotionFadeVariants()
  }

  return {
    initial: { opacity: 0, transform: 'translateY(4px) scale(0.99)' },
    animate: {
      opacity: 1,
      transform: 'translateY(0px) scale(1)',
      transition: { duration: enterDuration, ease: entranceEase },
    },
    exit: {
      opacity: 0,
      transform: 'translateY(-4px) scale(0.99)',
      transition: { duration: exitDuration, ease: entranceEase },
    },
  }
}

/** Soft scale + fade for overlay marks (e.g. composer product logo). */
export function scaleFadeVariants(reduceMotion: boolean) {
  if (reduceMotion) {
    return reducedMotionFadeVariants()
  }

  return {
    initial: { opacity: 0, transform: 'scale(0.95)' },
    animate: {
      opacity: 1,
      transform: 'scale(1)',
      transition: { duration: enterDuration, ease: entranceEase },
    },
    exit: {
      opacity: 0,
      transform: 'scale(0.95)',
      transition: { duration: exitDuration, ease: entranceEase },
    },
  }
}

export function scaleFadeVariantsAggressive(reduceMotion: boolean) {
  if (reduceMotion) {
    return reducedMotionFadeVariants()
  }

  return {
    initial: { opacity: 0, transform: 'scale(0.95)' },
    animate: {
      opacity: 1,
      transform: 'scale(1)',
      transition: { duration: reducedEnterDuration, ease: entranceEase },
    },
    exit: {
      opacity: 0,
      transform: 'scale(0)',
      transition: { duration: reducedExitDuration, ease: entranceEase },
    },
  }
}

/** Soft enter/exit for list rows inside an expanded panel (not the panel shell). */
export function composerPanelVariants(reduceMotion: boolean) {
  if (reduceMotion) {
    return reducedMotionFadeVariants()
  }

  return {
    initial: { opacity: 0, transform: 'translateY(-4px) scale(0.98)' },
    animate: {
      opacity: 1,
      transform: 'translateY(0px) scale(1)',
      transition: { duration: enterDuration, ease: entranceEase },
    },
    exit: {
      opacity: 0,
      transform: 'translateY(-4px) scale(0.98)',
      transition: { duration: exitDuration, ease: entranceEase },
    },
  }
}

/** Crossfade for product carousel empty ↔ carousel shell (mode="wait" — keep durations short). */
export function carouselShellVariants(reduceMotion: boolean) {
  return feedEmptyStateVariants(reduceMotion)
}

/** Horizontal enter/exit for carousel image slides. */
export function carouselSlideVariants(reduceMotion: boolean) {
  if (reduceMotion) {
    return reducedMotionFadeVariants()
  }

  return {
    initial: { opacity: 0, transform: 'translateX(12px) scale(0.98)' },
    animate: {
      opacity: 1,
      transform: 'translateX(0px) scale(1)',
      transition: { duration: enterDuration, ease: entranceEase },
    },
    exit: {
      opacity: 0,
      transform: 'translateX(-8px) scale(0.98)',
      transition: { duration: exitDuration, ease: entranceEase },
    },
  }
}

export function aspectRatioTransition(reduceMotion: boolean) {
  return reduceMotion
    ? { duration: 0 }
    : { duration: layoutDuration, ease: entranceEase }
}

/** Press feedback for icon buttons and menu triggers. */
export const pressableTapScale = 0.97

/** Opacity-only transitions (e.g. pending-delete dim). */
export function opacityTransition(reduceMotion: boolean) {
  return reduceMotion
    ? { duration: 0 }
    : { duration: enterDuration, ease: entranceEase }
}

/** Origin-aware popover panel — pair with `origin-top-right` (or matching origin class). */
export function popoverPanelVariants(reduceMotion: boolean) {
  return scaleFadeVariants(reduceMotion)
}

/**
 * Vertical slide for swapping rows inside a fixed-height panel (delete ↔ confirm).
 * Pass `custom={isConfirmVisible}` to AnimatePresence children.
 */
export function panelRowSlideVariants(reduceMotion: boolean) {
  if (reduceMotion) {
    return reducedMotionFadeVariants()
  }

  const offset = '8px'

  return {
    initial: (isConfirmVisible: boolean) => ({
      opacity: 0,
      transform: isConfirmVisible
        ? `translateY(${offset})`
        : `translateY(-${offset})`,
    }),
    animate: {
      opacity: 1,
      transform: 'translateY(0px)',
      transition: { duration: enterDuration, ease: entranceEase },
    },
    exit: (isConfirmVisible: boolean) => ({
      opacity: 0,
      transform: isConfirmVisible
        ? `translateY(-${offset})`
        : `translateY(${offset})`,
      transition: { duration: exitDuration, ease: entranceEase },
    }),
  }
}

/** Height + fade for expanding composer panels (poll controls). Keep content in flow. */
export function composerExpandVariants(reduceMotion: boolean) {
  if (reduceMotion) {
    return reducedMotionFadeVariants()
  }

  return {
    initial: { height: 0, opacity: 0 },
    animate: {
      height: 'auto',
      opacity: 1,
      transition: {
        height: { duration: enterDuration, ease: entranceEase },
        opacity: { duration: enterDuration, ease: entranceEase },
      },
    },
    exit: {
      height: 0,
      opacity: 0,
      transition: {
        height: { duration: exitDuration, ease: entranceEase },
        opacity: { duration: exitDuration, ease: entranceEase },
      },
    },
  }
}
