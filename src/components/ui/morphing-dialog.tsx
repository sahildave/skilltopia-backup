import { Slot } from '@radix-ui/react-slot';
import { XIcon } from 'lucide-react';
import { MotionConfig, motion, type Transition, type Variant } from 'motion/react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';

import { useClickOutside } from '@/hooks/use-click-outside';
import { cn } from '@/lib/utils';

const MotionSlot = motion.create(Slot);

/** Own tween, so the backdrop never inherits the dialog's morph timing. */
const BACKDROP_FADE = { duration: 0.2, ease: 'easeOut' } as const;

/**
 * The shell is a projection node, so its whole subtree inherits the card→dialog
 * scale — and only descendants that are projection nodes themselves get that
 * scale corrected. Rather than make every section a projection node, the body
 * fades in over the tail of the morph: the distorted frames are never on
 * screen, and the shell (a rounded rectangle, which scales cleanly) carries
 * the motion on its own.
 */
const CONTENT_FADE = { duration: 0.18, delay: 0.1, ease: 'easeOut' } as const;

interface MorphingDialogContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  uniqueId: string;
  triggerRef: RefObject<HTMLElement | null>;
}

const MorphingDialogContext = createContext<MorphingDialogContextValue | null>(null);

/**
 * Whether the subtree is the dialog body rather than the trigger. Title and
 * subtitle are rendered on both surfaces, so the title's `aria-labelledby`
 * target has to be claimed by exactly one of them — the dialog's.
 */
const MorphingDialogBodyContext = createContext(false);

function useMorphingDialog() {
  const context = useContext(MorphingDialogContext);
  if (!context) {
    throw new Error('useMorphingDialog must be used within a MorphingDialog');
  }
  return context;
}

/**
 * Closes the enclosing morphing dialog. Returns a no-op outside one, so shared
 * card actions can use it whether or not they're rendered inside a dialog.
 */
function useMorphingDialogClose() {
  const context = useContext(MorphingDialogContext);
  const setIsOpen = context?.setIsOpen;
  return useCallback(() => setIsOpen?.(false), [setIsOpen]);
}

interface MorphingDialogProps {
  children: ReactNode;
  transition?: Transition;
}

function MorphingDialog({ children, transition }: MorphingDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const uniqueId = useId();
  const triggerRef = useRef<HTMLElement | null>(null);

  return (
    <MorphingDialogContext.Provider value={{ isOpen, setIsOpen, uniqueId, triggerRef }}>
      <MotionConfig transition={transition}>{children}</MotionConfig>
    </MorphingDialogContext.Provider>
  );
}

const NESTED_INTERACTIVE_SELECTOR =
  'button, a, input, textarea, select, [role="menuitem"], [role="option"]';

function isNestedInteractiveTarget(target: EventTarget | null, currentTarget: EventTarget | null) {
  if (!(target instanceof Element) || !(currentTarget instanceof Element)) {
    return false;
  }
  const interactive = target.closest(NESTED_INTERACTIVE_SELECTOR);
  return interactive != null && interactive !== currentTarget;
}

interface MorphingDialogTriggerProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** Merge props onto the child (e.g. a card) instead of rendering a button. */
  asChild?: boolean;
}

function MorphingDialogTrigger({
  children,
  className,
  style,
  asChild = false,
}: MorphingDialogTriggerProps) {
  const { setIsOpen, isOpen, uniqueId, triggerRef } = useMorphingDialog();
  const Comp = asChild ? MotionSlot : motion.button;

  return (
    <Comp
      ref={triggerRef as Ref<HTMLButtonElement>}
      layoutId={`dialog-${uniqueId}`}
      className={cn('relative', isOpen && 'pointer-events-none', className)}
      onClick={(event: ReactMouseEvent) => {
        if (isNestedInteractiveTarget(event.target, event.currentTarget)) {
          return;
        }
        setIsOpen(!isOpen);
      }}
      onKeyDown={(event: ReactKeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== ' ') {
          return;
        }
        if (isNestedInteractiveTarget(event.target, event.currentTarget)) {
          return;
        }
        event.preventDefault();
        setIsOpen(!isOpen);
      }}
      style={{ ...style, opacity: isOpen ? 0 : 1 }}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-controls={`morphing-dialog-content-${uniqueId}`}
      aria-hidden={isOpen}
      tabIndex={isOpen ? -1 : undefined}
      {...(asChild ? {} : { type: 'button' as const })}
    >
      {children}
    </Comp>
  );
}

interface MorphingDialogContentProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

function MorphingDialogContent({ children, className, style }: MorphingDialogContentProps) {
  const { setIsOpen, isOpen, uniqueId, triggerRef } = useMorphingDialog();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [setIsOpen]);

  useEffect(() => {
    if (!isOpen) {
      triggerRef.current?.focus();
      return;
    }

    document.body.classList.add('overflow-hidden');
    const focusable = containerRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

    // Runs on close *and* on unmount, so a trigger that disappears while the
    // dialog is open (its row deleted underneath it) can't strand the lock.
    return () => {
      document.body.classList.remove('overflow-hidden');
    };
  }, [isOpen, triggerRef]);

  useClickOutside(containerRef, () => {
    if (isOpen) setIsOpen(false);
  });

  return (
    <motion.div
      ref={containerRef}
      layoutId={`dialog-${uniqueId}`}
      className={cn('overflow-hidden', className)}
      style={style}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`morphing-dialog-title-${uniqueId}`}
      id={`morphing-dialog-content-${uniqueId}`}
    >
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={CONTENT_FADE}>
        <MorphingDialogBodyContext.Provider value={true}>
          {children}
        </MorphingDialogBodyContext.Provider>
      </motion.div>
    </motion.div>
  );
}

interface MorphingDialogContainerProps {
  children: ReactNode;
}

function MorphingDialogContainer({ children }: MorphingDialogContainerProps) {
  const { isOpen, uniqueId } = useMorphingDialog();
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  if (!mounted) return null;

  // Both layers cover the whole app, so neither may outlive `isOpen`. An
  // AnimatePresence exit here could stall mid-flight — the morph re-runs
  // whenever the trigger's own layout shifts under an open dialog — and left
  // the backdrop stranded at full opacity with nothing able to remove it. Fade
  // in on open, drop on close: removal is React state, never an animation.
  return createPortal(
    <>
      {isOpen ? (
        <motion.div
          key={`backdrop-${uniqueId}`}
          className="pointer-events-none fixed inset-0 z-50 bg-black/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={BACKDROP_FADE}
          aria-hidden="true"
        />
      ) : null}
      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">{children}</div>
      ) : null}
    </>,
    document.body,
  );
}

interface MorphingDialogTitleProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * Deliberately *not* a shared layout target. The card and dialog titles differ in
 * font size and truncation, so morphing between them meant stretching glyphs by
 * the (anisotropic) card→dialog scale and rendering the larger font-size — which
 * layout projection never interpolates — at up to that full scale. They cross-fade
 * with the rest of the body instead.
 */
function MorphingDialogTitle({ children, className, style }: MorphingDialogTitleProps) {
  const { uniqueId } = useMorphingDialog();
  const isDialogBody = useContext(MorphingDialogBodyContext);

  return (
    <div
      className={className}
      style={style}
      id={isDialogBody ? `morphing-dialog-title-${uniqueId}` : undefined}
    >
      <div className="truncate text-balance line-clamp-1 font-semibold leading-normal">
        {children}
      </div>
    </div>
  );
}

interface MorphingDialogSubtitleProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Not a shared layout target either — see {@link MorphingDialogTitle}. */
function MorphingDialogSubtitle({ children, className, style }: MorphingDialogSubtitleProps) {
  return (
    <div className={className} style={style}>
      <div className="text-muted-foreground truncate text-sm text-pretty">{children}</div>
    </div>
  );
}

interface MorphingDialogDescriptionProps {
  children: ReactNode;
  className?: string;
  disableLayoutAnimation?: boolean;
  variants?: {
    initial: Variant;
    animate: Variant;
    exit: Variant;
  };
}

function MorphingDialogDescription({
  children,
  className,
  variants,
  disableLayoutAnimation,
}: MorphingDialogDescriptionProps) {
  const { uniqueId } = useMorphingDialog();

  return (
    <motion.div
      layoutId={disableLayoutAnimation ? undefined : `dialog-description-content-${uniqueId}`}
      variants={variants}
      className={className}
      initial="initial"
      animate="animate"
      exit="exit"
      id={`morphing-dialog-description-${uniqueId}`}
    >
      {children}
    </motion.div>
  );
}

interface MorphingDialogImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
}

function MorphingDialogImage({ src, alt, className, style }: MorphingDialogImageProps) {
  const { uniqueId } = useMorphingDialog();

  return (
    <motion.img
      src={src}
      alt={alt}
      className={cn(className)}
      layoutId={`dialog-img-${uniqueId}`}
      style={style}
    />
  );
}

interface MorphingDialogCloseProps {
  children?: ReactNode;
  className?: string;
  variants?: {
    initial: Variant;
    animate: Variant;
    exit: Variant;
  };
}

function MorphingDialogClose({ children, className, variants }: MorphingDialogCloseProps) {
  const { setIsOpen } = useMorphingDialog();

  return (
    <motion.button
      type="button"
      onClick={() => setIsOpen(false)}
      aria-label="Close dialog"
      className={cn(
        'app-pressable ring-offset-background focus:ring-ring absolute top-8.5 right-8 rounded-xs opacity-70 hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden',
        className,
      )}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
    >
      {children ?? <XIcon className="size-6" />}
    </motion.button>
  );
}

export {
  MorphingDialog,
  MorphingDialogClose,
  MorphingDialogContainer,
  MorphingDialogContent,
  MorphingDialogDescription,
  MorphingDialogImage,
  MorphingDialogSubtitle,
  MorphingDialogTitle,
  MorphingDialogTrigger,
  useMorphingDialogClose
};

