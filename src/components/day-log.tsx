import { Coffee, Utensils, Wine, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { TimeInput } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/screen";
import { coffeeTips } from "@/lib/flags";
import { effectiveSlotTimes } from "@/lib/protocol";
import { useSupplime } from "@/lib/store";
import type { DayContext } from "@/lib/types";
import { cn, formatClock, formatHHMM } from "@/lib/utils";

type Kind = "coffee" | "meal" | "drink";
const FIELD: Record<Kind, "coffeeAt" | "mealsAt" | "alcoholAt"> = {
  coffee: "coffeeAt",
  meal: "mealsAt",
  drink: "alcoholAt",
};
const META: Record<Kind, { label: string; icon: typeof Coffee; done: string }> = {
  coffee: {
    label: "Coffee",
    icon: Coffee,
    done: "Supplime spaces anything that clashes with caffeine.",
  },
  meal: { label: "Meal", icon: Utensils, done: "Food-sensitive doses now follow your real meal." },
  drink: {
    label: "Drink",
    icon: Wine,
    done: "Anything that clashes with alcohol tonight is flagged.",
  },
};

/**
 * Today's timeline of coffee, meals and drinks. Pick what, pick when (defaults to now),
 * confirm. Each entry is a chip you can remove.
 */
export function DayLog({ date, day, nowMin }: { date: string; day?: DayContext; nowMin: number }) {
  const setDay = useSupplime((s) => s.setDay);
  const [adding, setAdding] = useState<Kind | null>(null);
  const entries = (Object.keys(FIELD) as Kind[])
    .flatMap((kind) => (day?.[FIELD[kind]] ?? []).map((at, i) => ({ kind, at, i })))
    .sort((a, b) => sortable(a.at) - sortable(b.at));

  const remove = (kind: Kind, at: string) => {
    const list = day?.[FIELD[kind]] ?? [];
    const idx = list.indexOf(at);
    const next = list.filter((_, i) => i !== idx);
    setDay(date, { [FIELD[kind]]: next });
    toast(`${META[kind].label} at ${formatClock(at)} removed`, {
      action: { label: "Undo", onClick: () => setDay(date, { [FIELD[kind]]: list }) },
    });
  };

  return (
    <div className="space-y-2">
      {entries.length > 0 && (
        <ol className="flex flex-wrap gap-1.5" aria-label="Today's log">
          {entries.map((e) => {
            const Icon = META[e.kind].icon;
            return (
              <li
                key={`${e.kind}-${e.at}-${e.i}`}
                className="inline-flex items-center gap-1 rounded-full bg-accent py-1 pr-1 pl-2.5 text-xs font-medium text-accent-foreground"
              >
                <Icon className="size-3.5" />
                {formatClock(e.at)}
                <button
                  type="button"
                  aria-label={`Remove ${META[e.kind].label} at ${formatClock(e.at)}`}
                  onClick={() => remove(e.kind, e.at)}
                  className="flex size-6 items-center justify-center rounded-full hover:bg-background/40"
                >
                  <X className="size-3" />
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Log:</span>
        {(Object.keys(META) as Kind[]).map((kind) => {
          const Icon = META[kind].icon;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => setAdding(kind)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-secondary px-3 text-xs font-medium text-secondary-foreground active:scale-95"
            >
              <Icon className="size-4" /> {META[kind].label}
            </button>
          );
        })}
      </div>
      {adding && (
        <AddEntry
          kind={adding}
          nowMin={nowMin}
          onClose={() => setAdding(null)}
          onAdd={(at) => {
            const list = day?.[FIELD[adding]] ?? [];
            if (list.includes(at)) {
              toast(`${META[adding].label} at ${formatClock(at)} is already logged`);
            } else {
              setDay(date, { [FIELD[adding]]: [...list, at].sort() });
              const tips = adding === "coffee" ? coffeeTipsNow(date, at) : [];
              if (tips.length === 0)
                toast(`${META[adding].label} at ${formatClock(at)} added`, {
                  description: META[adding].done,
                });
              for (const t of tips) {
                toast(t.kind === "take-now" ? "Coffee logged: good moment" : "Coffee logged", {
                  description: t.text,
                  duration: 12000,
                  action:
                    t.kind === "take-now"
                      ? {
                          label: `Take ${t.item.name}`,
                          onClick: () => {
                            useSupplime.getState().logDose(t.item.id, t.slot, "taken", date);
                            toast(`${t.item.name} taken with your coffee`);
                          },
                        }
                      : undefined,
                });
              }
            }
            setAdding(null);
          }}
        />
      )}
    </div>
  );
}

function AddEntry({
  kind,
  nowMin,
  onClose,
  onAdd,
}: {
  kind: Kind;
  nowMin: number;
  onClose: () => void;
  onAdd: (at: string) => void;
}) {
  const wrap = (m: number) => ((m % 1440) + 1440) % 1440;
  const presets = [
    { label: "Now", min: wrap(nowMin) },
    { label: "15 min ago", min: wrap(nowMin - 15) },
    { label: "30 min ago", min: wrap(nowMin - 30) },
    { label: "1 h ago", min: wrap(nowMin - 60) },
  ];
  const [at, setAt] = useState(formatHHMM(((nowMin % 1440) + 1440) % 1440));
  const Icon = META[kind].icon;
  return (
    <Sheet onClose={onClose} title={`Add ${META[kind].label.toLowerCase()} to today`}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {presets.map((p) => (
            <Pick
              key={p.label}
              on={at === formatHHMM(p.min)}
              onClick={() => setAt(formatHHMM(p.min))}
            >
              <span className="block font-medium">{p.label}</span>
              <span className="block text-xs opacity-75">{formatClock(formatHHMM(p.min))}</span>
            </Pick>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Or exact time</span>
          <TimeInput value={at} onChange={setAt} />
        </div>
        <Button className="w-full" onClick={() => onAdd(at)}>
          <Icon /> Add {META[kind].label.toLowerCase()} at {formatClock(at)}
        </Button>
      </div>
    </Sheet>
  );
}

function Pick({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "rounded-xl border-2 px-3 py-2 text-left text-sm transition-colors",
        on ? "border-primary bg-accent/60" : "border-border bg-card",
      )}
    >
      {children}
    </button>
  );
}

function coffeeTipsNow(date: string, cup: string) {
  const { stack, logs, profile, days } = useSupplime.getState();
  const { times } = effectiveSlotTimes(profile, days, date);
  return coffeeTips({
    stack: stack.filter((i) => i.startedAt <= date),
    logs,
    profile,
    times,
    date,
    cup,
  });
}

/** Times after midnight (but before ~5 am) sort at the end of the day. */
const sortable = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return ((h! + 24 - 5) % 24) * 60 + m!;
};
