"use client";

import { XIcon } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const DEFAULT_HOTKEY: string[] = ["F8"];
const DEFAULT_LABEL = "Notifications";
const DEFAULT_DURATION_IN_MS = 5000;
const TOAST_UNMOUNT_DELAY_IN_MS = 1200;

type ToastProviderContextValue = {
  duration: number;
  label: string;
  hotkey: string[];
  registerViewport: (viewport: HTMLElement | null) => void;
};

const ToastProviderContext =
  React.createContext<ToastProviderContextValue | null>(null);

type ToastProviderProps = {
  children?: React.ReactNode;
  duration?: number;
  label?: string;
  hotkey?: string[];
};

type ToastViewportProps = React.ComponentPropsWithoutRef<"section"> & {
  label?: string;
  hotkey?: string[];
};

type ToastProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  duration?: number;
  forceMount?: true;
} & React.ComponentPropsWithoutRef<"li">;

type ToastContextValue = {
  close: () => void;
  pauseAutoDismiss: () => void;
  resumeAutoDismiss: () => void;
  isVisible: boolean;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);

type ToastActionProps = React.ComponentPropsWithoutRef<"button"> & {
  altText: string;
};

type ToastCloseProps = React.ComponentPropsWithoutRef<"button">;

type ToastTitleProps = React.ComponentPropsWithoutRef<"div">;

type ToastDescriptionProps = React.ComponentPropsWithoutRef<"div">;

type ToastActionElement = React.ReactElement<ToastActionProps>;

function isHotkeyMatch(event: KeyboardEvent, hotkey: string[]) {
  if (hotkey.length === 0) {
    return false;
  }

  const normalizedHotkey = hotkey.map((key) => key.toLowerCase());
  const requiresAlt = normalizedHotkey.includes("alt");
  const requiresControl =
    normalizedHotkey.includes("control") || normalizedHotkey.includes("ctrl");
  const requiresMeta = normalizedHotkey.includes("meta");
  const requiresShift = normalizedHotkey.includes("shift");

  if (event.altKey !== requiresAlt) {
    return false;
  }
  if (event.ctrlKey !== requiresControl) {
    return false;
  }
  if (event.metaKey !== requiresMeta) {
    return false;
  }
  if (event.shiftKey !== requiresShift) {
    return false;
  }

  const nonModifierKeys = normalizedHotkey.filter(
    (key) => !["alt", "control", "ctrl", "meta", "shift"].includes(key),
  );

  if (nonModifierKeys.length === 0) {
    return false;
  }

  return nonModifierKeys.some((key) => event.key.toLowerCase() === key);
}

function useToastProviderContext() {
  const context = React.useContext(ToastProviderContext);
  if (context) {
    return context;
  }

  return {
    duration: DEFAULT_DURATION_IN_MS,
    label: DEFAULT_LABEL,
    hotkey: DEFAULT_HOTKEY,
    registerViewport: () => {},
  } satisfies ToastProviderContextValue;
}

function useToastContext(componentName: string) {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error(
      `${componentName} must be used within a <Toast /> component.`,
    );
  }
  return context;
}

function composeRefs<T>(
  ...refs: (React.Ref<T> | undefined)[]
): (node: T | null) => void {
  return (node) => {
    for (const ref of refs) {
      if (!ref) {
        continue;
      }
      if (typeof ref === "function") {
        ref(node);
        continue;
      }
      (ref as React.MutableRefObject<T | null>).current = node;
    }
  };
}

/**
 * ToastProvider wires global behaviours such as default duration and viewport hotkey
 * focus handling for every toast rendered inside the provider.
 */
const ToastProvider = function ToastProvider({
  children,
  duration = DEFAULT_DURATION_IN_MS,
  label = DEFAULT_LABEL,
  hotkey = DEFAULT_HOTKEY,
}: ToastProviderProps) {
  const viewportRef = React.useRef<HTMLElement | null>(null);

  const registerViewport = React.useCallback((viewport: HTMLElement | null) => {
    viewportRef.current = viewport;
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isHotkeyMatch(event, hotkey)) {
        return;
      }

      const viewport = viewportRef.current;
      if (!viewport) {
        return;
      }

      event.preventDefault();
      viewport.focus();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hotkey]);

  const contextValue = React.useMemo<ToastProviderContextValue>(
    () => ({ duration, label, hotkey, registerViewport }),
    [duration, label, hotkey, registerViewport],
  );

  return (
    <ToastProviderContext.Provider value={contextValue}>
      {children}
    </ToastProviderContext.Provider>
  );
};

const ToastViewport = React.forwardRef<HTMLElement, ToastViewportProps>(
  function ToastViewport(
    { className, label, hotkey, children, ...props },
    ref,
  ) {
    const providerContext = useToastProviderContext();
    const announcedLabel = label ?? providerContext.label;
    const effectiveHotkey = hotkey ?? providerContext.hotkey;
    const hotkeyDescription =
      effectiveHotkey.length > 0 ? effectiveHotkey.join("+") : undefined;

    return (
      <section
        ref={composeRefs(ref, providerContext.registerViewport)}
        aria-label={
          hotkeyDescription
            ? `${announcedLabel} (${hotkeyDescription})`
            : announcedLabel
        }
        tabIndex={-1}
        data-slot="toast-viewport"
        className={cn(
          "pointer-events-none fixed inset-x-0 top-0 z-[60] flex max-h-screen flex-col overflow-y-auto p-4 sm:inset-x-auto sm:right-4 sm:left-auto",
          className,
        )}
        {...props}
      >
        <ol className="flex flex-col gap-3">{children}</ol>
      </section>
    );
  },
);

const Toast = React.forwardRef<HTMLLIElement, ToastProps>(function Toast(
  {
    className,
    open,
    defaultOpen = false,
    onOpenChange,
    duration,
    forceMount,
    ...props
  },
  ref,
) {
  const providerContext = useToastProviderContext();
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setUncontrolledOpen(nextOpen);
      }
      onOpenChange?.(nextOpen);
    },
    [isControlled, onOpenChange],
  );

  const [shouldRender, setShouldRender] = React.useState(forceMount ?? isOpen);

  React.useEffect(() => {
    if (forceMount) {
      setShouldRender(true);
      return;
    }

    if (isOpen) {
      setShouldRender(true);
      return;
    }

    const timeout = window.setTimeout(
      () => setShouldRender(false),
      TOAST_UNMOUNT_DELAY_IN_MS,
    );

    return () => window.clearTimeout(timeout);
  }, [forceMount, isOpen]);

  const autoDismissTimerRef = React.useRef<number | null>(null);

  const clearAutoDismiss = React.useCallback(() => {
    if (autoDismissTimerRef.current === null) {
      return;
    }
    window.clearTimeout(autoDismissTimerRef.current);
    autoDismissTimerRef.current = null;
  }, []);

  const startAutoDismiss = React.useCallback(() => {
    if (!isOpen) {
      return;
    }

    const autoDismissDuration = duration ?? providerContext.duration;
    if (autoDismissDuration === Infinity || autoDismissDuration <= 0) {
      return;
    }

    clearAutoDismiss();
    autoDismissTimerRef.current = window.setTimeout(() => {
      handleOpenChange(false);
    }, autoDismissDuration);
  }, [
    clearAutoDismiss,
    duration,
    handleOpenChange,
    isOpen,
    providerContext.duration,
  ]);

  React.useEffect(() => {
    startAutoDismiss();
    return clearAutoDismiss;
  }, [startAutoDismiss, clearAutoDismiss]);

  const pauseAutoDismiss = React.useCallback(() => {
    clearAutoDismiss();
  }, [clearAutoDismiss]);

  const resumeAutoDismiss = React.useCallback(() => {
    startAutoDismiss();
  }, [startAutoDismiss]);

  const contextValue = React.useMemo<ToastContextValue>(
    () => ({
      close: () => handleOpenChange(false),
      pauseAutoDismiss,
      resumeAutoDismiss,
      isVisible: Boolean(isOpen),
    }),
    [handleOpenChange, pauseAutoDismiss, resumeAutoDismiss, isOpen],
  );

  if (!shouldRender) {
    return null;
  }

  return (
    <ToastContext.Provider value={contextValue}>
      <li
        ref={ref}
        aria-live="polite"
        aria-atomic="true"
        data-slot="toast"
        data-state={isOpen ? "open" : "closed"}
        onMouseEnter={(event) => {
          pauseAutoDismiss();
          props.onMouseEnter?.(event);
        }}
        onMouseLeave={(event) => {
          resumeAutoDismiss();
          props.onMouseLeave?.(event);
        }}
        className={cn(
          "bg-background text-foreground pointer-events-auto relative flex w-full max-w-md items-start gap-4 rounded-xl border p-4 shadow-lg transition-all data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-80 data-[state=open]:slide-in-from-top sm:data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-right",
          className,
        )}
        {...props}
      />
    </ToastContext.Provider>
  );
});

const ToastAction = React.forwardRef<HTMLButtonElement, ToastActionProps>(
  function ToastAction(
    { className, altText, children, onClick, onFocus, onBlur, ...props },
    ref,
  ) {
    const toast = useToastContext("ToastAction");

    return (
      <button
        ref={ref}
        type="button"
        data-slot="toast-action"
        className={cn(
          "border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-offset-background rounded-md border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          className,
        )}
        onFocus={(event) => {
          toast.pauseAutoDismiss();
          onFocus?.(event);
        }}
        onBlur={(event) => {
          toast.resumeAutoDismiss();
          onBlur?.(event);
        }}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) {
            toast.close();
          }
        }}
        {...props}
      >
        {children}
        <span className="sr-only">{altText}</span>
      </button>
    );
  },
);

const ToastClose = React.forwardRef<HTMLButtonElement, ToastCloseProps>(
  function ToastClose({ className, onClick, onFocus, onBlur, ...props }, ref) {
    const toast = useToastContext("ToastClose");

    return (
      <button
        ref={ref}
        type="button"
        data-slot="toast-close"
        className={cn(
          "text-muted-foreground hover:text-foreground absolute right-3 top-3 rounded-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          className,
        )}
        onFocus={(event) => {
          toast.pauseAutoDismiss();
          onFocus?.(event);
        }}
        onBlur={(event) => {
          toast.resumeAutoDismiss();
          onBlur?.(event);
        }}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) {
            toast.close();
          }
        }}
        {...props}
      >
        <XIcon className="size-4" />
        <span className="sr-only">Fermer</span>
      </button>
    );
  },
);

const ToastTitle = React.forwardRef<HTMLDivElement, ToastTitleProps>(
  function ToastTitle({ className, ...props }, ref) {
    return (
      <div
        ref={ref}
        data-slot="toast-title"
        className={cn("text-sm font-semibold", className)}
        {...props}
      />
    );
  },
);

const ToastDescription = React.forwardRef<
  HTMLDivElement,
  ToastDescriptionProps
>(function ToastDescription({ className, ...props }, ref) {
  return (
    <div
      ref={ref}
      data-slot="toast-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  );
});

ToastViewport.displayName = "ToastViewport";
Toast.displayName = "Toast";
ToastAction.displayName = "ToastAction";
ToastClose.displayName = "ToastClose";
ToastTitle.displayName = "ToastTitle";
ToastDescription.displayName = "ToastDescription";

export {
  Toast,
  ToastAction,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
};
export type { ToastActionElement, ToastProps };
