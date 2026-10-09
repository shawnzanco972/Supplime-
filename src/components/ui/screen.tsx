import * as DialogPrimitive from "@radix-ui/react-dialog";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * A full-screen panel with a back arrow, a scrolling body and a fixed footer for the
 * main action. Used instead of tall pop-ups, which are awkward to scroll on a phone.
 */
export function Screen({
  open = true,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open?: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          onPointerDownOutside={keepOpenForToasts}
          onInteractOutside={keepOpenForToasts}
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col bg-background text-foreground focus:outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4"
        >
          <header className="flex items-center gap-1 border-b border-border bg-background px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2">
            <DialogPrimitive.Close
              className="flex size-11 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Back"
            >
              <ArrowLeft className="size-5" />
            </DialogPrimitive.Close>
            <div className="min-w-0">
              <DialogPrimitive.Title className="truncate font-display text-xl tracking-tight">
                {title}
              </DialogPrimitive.Title>
              {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </header>
          <div className="flex-1 overflow-y-auto overscroll-contain">
            <div className="mx-auto w-full max-w-xl px-4 py-5">{children}</div>
          </div>
          {footer && (
            <footer className="border-t border-border bg-card px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <div className="mx-auto flex w-full max-w-xl gap-2">{footer}</div>
            </footer>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** A sheet that slides up from the bottom, for quick choices. */
export function Sheet({
  open = true,
  onClose,
  title,
  description,
  children,
  className,
}: {
  open?: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-foreground/30 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onPointerDownOutside={keepOpenForToasts}
          onInteractOutside={keepOpenForToasts}
          aria-describedby={undefined}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88dvh] w-full max-w-xl overflow-y-auto rounded-t-3xl bg-card px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-card-foreground shadow-[var(--shadow-border)] focus:outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom-8",
            className,
          )}
        >
          <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-muted" aria-hidden />
          <DialogPrimitive.Title className="font-display text-xl tracking-tight">
            {title}
          </DialogPrimitive.Title>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          <div className="mt-4">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Small centred yes/no for destructive actions. */
export function Confirm({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  onConfirm,
  destructive = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[60] bg-foreground/40" />
        <DialogPrimitive.Content
          onPointerDownOutside={keepOpenForToasts}
          onInteractOutside={keepOpenForToasts}
          aria-describedby={undefined}
          className="fixed top-1/2 left-1/2 z-[60] w-[min(100%-2rem,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-5 shadow-[var(--shadow-border)] focus:outline-none"
        >
          <DialogPrimitive.Title className="font-display text-xl tracking-tight">
            {title}
          </DialogPrimitive.Title>
          <div className="mt-2 text-sm text-muted-foreground">{body}</div>
          <div className="mt-5 flex gap-2">
            <DialogPrimitive.Close className="h-11 flex-1 rounded-md bg-secondary text-sm font-medium">
              Cancel
            </DialogPrimitive.Close>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={cn(
                "h-11 flex-1 rounded-md text-sm font-medium",
                destructive
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-primary text-primary-foreground",
              )}
            >
              {confirmLabel}
            </button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Tapping a message (e.g. its Undo) must not close the panel underneath. */
function keepOpenForToasts(e: { target: EventTarget | null; preventDefault: () => void }) {
  const el = e.target as HTMLElement | null;
  if (el?.closest?.("[data-sonner-toaster]")) e.preventDefault();
}
