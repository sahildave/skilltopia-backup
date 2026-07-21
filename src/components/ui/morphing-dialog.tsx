import { Slot } from '@radix-ui/react-slot';
import { XIcon } from 'lucide-react';
import { AnimatePresence, MotionConfig, motion, type Transition, type Variant } from 'motion/react';
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, MotionConfig, motion, type Transition, type Variant } from 'motion/react';
import { XIcon } from 'lucide-react';
import { Slot } from '@radix-ui/react-slot';

import { useClickOutside } from '@/hooks/use-click-outside';
import { cn } from '@/lib/utils';

const MotionSlot = motion.create(Slot);

interface MorphingDialogContextValue {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  uniqueId: string;
  triggerRef: RefObject<HTMLElement | null>;
}

const MorphingDialogContext = createContext<MorphingDialogContextValue | null>(null);

function useMorphingDialog() {
  const context = useContext(MorphingDialogContext);
  if (!context) {
    throw new Error('useMorphingDialog must be used within a MorphingDialog');
  }
  return context;
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
      onClick={() => setIsOpen(!isOpen)}
      onKeyDown={(event: ReactKeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          setIsOpen(!isOpen);
        }
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
      document.body.classList.remove('overflow-hidden');
      triggerRef.current?.focus();
      return;
    }

    document.body.classList.add('overflow-hidden');
    const focusable = containerRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.[0]?.focus();

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
      {children}
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

  return createPortal(
    <>
      <AnimatePresence initial={false}>
        {isOpen ? (
          <motion.div
            key={`backdrop-${uniqueId}`}
            className="fixed inset-0 z-50 rounded-(--app-corner-radius) bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-hidden="true"
          />
        ) : null}
      </AnimatePresence>
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

function MorphingDialogTitle({ children, className, style }: MorphingDialogTitleProps) {
  const { uniqueId } = useMorphingDialog();

  return (
    <motion.div
      layoutId={`dialog-title-container-${uniqueId}`}
      className={className}
      style={style}
      layout
      id={`morphing-dialog-title-${uniqueId}`}
    >
      <div className="truncate text-balance line-clamp-1 font-semibold leading-normal">
        {children}
      </div>
    </motion.div>
  );
}

interface MorphingDialogSubtitleProps {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

function MorphingDialogSubtitle({ children, className, style }: MorphingDialogSubtitleProps) {
  const { uniqueId } = useMorphingDialog();

  return (
    <motion.div
      layoutId={`dialog-subtitle-container-${uniqueId}`}
      className={className}
      style={style}
    >
      <div className="text-muted-foreground truncate text-sm text-pretty">{children}</div>
    </motion.div>
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
        'app-pressable ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs opacity-70 hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden',
        className,
      )}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={variants}
    >
      {children ?? <XIcon className="size-4" />}
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
};
