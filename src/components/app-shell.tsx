import { Activity, BookOpen, Leaf, Settings2, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useNav, type Tab } from "@/lib/nav";
import { cn } from "@/lib/utils";

const NAV: { to: Tab; label: string; icon: typeof Leaf }[] = [
  { to: "today", label: "Today", icon: Leaf },
  { to: "stack", label: "Stack", icon: BookOpen },
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
            <p className="font-display text-2xl tracking-tight">Supplime</p>
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
            <p className="font-display text-xl tracking-tight">Supplime</p>
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

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
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
                  "flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <item.icon className="size-5" />
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
