import { Activity, Archive, Settings2, Sparkles } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { useNav, type Tab } from "@/lib/nav";
import { cn } from "@/lib/utils";

type NavIcon = ComponentType<{ className?: string; strokeWidth?: number }>;

const NAV: { to: Tab; label: string; icon: NavIcon }[] = [
  { to: "today", label: "Today", icon: LimeMark },
  { to: "stack", label: "Cabinet", icon: Archive },
  { to: "journey", label: "Journey", icon: Sparkles },
  { to: "body", label: "Body", icon: Activity },
];

export function AppShell({
  children,
  onOpenSettings,
}: {
  children: ReactNode;
  onOpenSettings: () => void;
}) {
  const pathname = useNav((s) => s.tab);
  const go = useNav((s) => s.go);

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl">
        <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-border px-4 py-6 md:flex">
          <div className="px-2">
            <Wordmark className="h-7" />
            <p className="mt-1 text-xs text-muted-foreground">Your stack, on time.</p>
          </div>
          <nav className="mt-8 flex flex-col gap-1">
            {NAV.map((item) => {
              const active = pathname === item.to;
              return (
                <button
                  type="button"
                  key={item.to}
                  onClick={() => go(item.to)}
                  className={cn(
                    "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <button
            type="button"
            onClick={onOpenSettings}
            className="mt-auto flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
          >
            <Settings2 className="size-4" />
            Settings
          </button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-2 md:hidden">
            <Wordmark className="h-6" />
            <button
              type="button"
              onClick={onOpenSettings}
              className="flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="Settings"
            >
              <Settings2 className="size-5" />
            </button>
          </header>
          <main className="flex-1 px-4 pb-28 md:px-8 md:pt-8 md:pb-10">{children}</main>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 bg-primary pb-[env(safe-area-inset-bottom)] text-primary-foreground md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {NAV.map((item) => {
            const active = pathname === item.to;
            return (
              <button
                type="button"
                key={item.to}
                onClick={() => go(item.to)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] transition-colors",
                  active ? "font-semibold text-white" : "font-medium text-white/65",
                )}
              >
                {active && (
                  <span className="absolute top-0 h-0.5 w-10 rounded-full bg-white" aria-hidden />
                )}
                <span
                  className={cn(
                    "flex h-8 w-14 items-center justify-center rounded-full transition-colors",
                    active ? "bg-white/18" : "active:bg-white/10",
                  )}
                >
                  <item.icon className="size-5" strokeWidth={active ? 2.4 : 1.8} />
                </span>
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/** The Supplime wordmark (lime-slice "e"). */
export function Wordmark({ className, reversed }: { className?: string; reversed?: boolean }) {
  return (
    <img
      src={`${import.meta.env.BASE_URL}brand/supplime-wordmark${reversed ? "-reversed" : ""}.svg`}
      alt="Supplime"
      className={cn("w-auto select-none", className)}
      draggable={false}
    />
  );
}

/** The lime-slice "e" on its own, in the current text color (used as the Today icon). */
export function LimeMark({ className }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="currentColor" aria-hidden>
      <path
        opacity={0.75}
        d="M57.21 58.4 L83.52,58.4 A34.56 34.56 0 0 1 69.02,78.86 ZM50 54.08 L65.48,80.9 A34.56 34.56 0 0 1 34.52,80.9 ZM42.79 58.4 L30.98,78.86 A34.56 34.56 0 0 1 16.48,58.4 ZM42.79 41.6 L16.48,41.6 A34.56 34.56 0 0 1 30.98,21.14 ZM50 45.92 L34.52,19.1 A34.56 34.56 0 0 1 65.48,19.1 ZM57.21 41.6 L69.02,21.14 A34.56 34.56 0 0 1 83.52,41.6 Z"
      />
      <path d="M84.53,83.34 A48 48 0 1 1 98 50 L88.4 50 A38.4 38.4 0 1 0 77.62,76.67 Z M8.72 45.44 H97.78 V54.56 H8.72 Z" />
    </svg>
  );
}
