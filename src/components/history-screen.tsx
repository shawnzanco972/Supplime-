import { Plane } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Chip, Field, Section } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { cellFor, type Cell } from "@/lib/insights";
import { useNav } from "@/lib/nav";
import { appToday, useSupplime } from "@/lib/store";
import { SLOTS, type SlotId } from "@/lib/types";
import { addDays, cn, formatShortDate, parseISODate } from "@/lib/utils";

const CELL: Record<Cell, string> = {
  taken: "bg-primary text-primary-foreground",
  partial: "bg-primary/45 text-foreground",
  missed: "bg-warn/40 text-foreground",
  away: "bg-muted-foreground/25",
  open: "border border-dashed border-muted-foreground/40",
  none: "text-muted-foreground/50",
};
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
const slotLabel = (id: SlotId) => SLOTS.find((s) => s.id === id)?.label ?? id;

/**
 * Fix your record: tap any day of the last 6 weeks to mark each dose taken or skipped,
 * or mark a whole trip as "away". Pills left follow your changes.
 */
export function HistoryScreen({ itemId }: { itemId?: string }) {
  const close = useNav((s) => s.close);
  const { stack, logs, setDoseRecord, markAway } = useSupplime();
  const today = appToday();
  const items = stack.filter((i) => !i.planned && i.startedAt <= today);
  const [selected, setSelected] = useState(itemId ?? items[0]?.id);
  const item = items.find((i) => i.id === selected) ?? items[0];
  const [day, setDay] = useState<string | null>(null);
  const [away, setAway] = useState({ from: addDays(today, -7), to: addDays(today, -1), all: true });

  // Six weeks, Monday first, ending this week.
  const weeks = useMemo(() => {
    const dow = (parseISODate(today).getDay() + 6) % 7;
    const start = addDays(today, -dow - 35);
    return Array.from({ length: 6 }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)),
    );
  }, [today]);

  if (!item) {
    return (
      <Screen onClose={close} title="History">
        <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
      </Screen>
    );
  }

  const record = (slot: SlotId, date: string) =>
    logs.find((l) => l.itemId === item.id && l.slot === slot && l.date === date);

  const applyAway = () => {
    if (away.from > away.to) {
      toast("The trip ends before it starts");
      return;
    }
    const before = { logs: useSupplime.getState().logs, stack: useSupplime.getState().stack };
    const n = markAway(away.all ? items.map((i) => i.id) : [item.id], away.from, away.to);
    toast(`${n} dose${n === 1 ? "" : "s"} marked as skipped (away)`, {
      description: `${formatShortDate(away.from)} – ${formatShortDate(away.to)}. Pills left updated.`,
      action: { label: "Undo", onClick: () => useSupplime.setState(before) },
    });
  };

  return (
    <Screen onClose={close} title="History" subtitle="Fix past days so your timeline is honest">
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {items.map((i) => (
            <Chip key={i.id} on={i.id === item.id} onClick={() => setSelected(i.id)}>
              {i.name}
            </Chip>
          ))}
        </div>

        <Section
          title={item.name}
          hint="Tap a day to change it. Fixes count as history: they keep your record honest but don't earn full XP."
        >
          <div className="grid grid-cols-7 gap-1 text-center" role="grid">
            {WEEKDAYS.map((w, i) => (
              <span key={i} className="text-[11px] text-muted-foreground">
                {w}
              </span>
            ))}
            {weeks.flat().map((date) => {
              const future = date > today;
              const c = future ? "none" : cellFor(item, logs, date, today);
              const edited = logs.some((l) => l.itemId === item.id && l.date === date && l.edited);
              const off = future || date < item.startedAt;
              return (
                <button
                  key={date}
                  type="button"
                  disabled={off}
                  onClick={() => setDay(date)}
                  aria-label={`${formatShortDate(date)}: ${c}`}
                  className={cn(
                    "relative flex aspect-square items-center justify-center rounded-lg text-xs tabular-nums disabled:opacity-30",
                    CELL[c],
                    day === date && "ring-2 ring-foreground ring-offset-1 ring-offset-card",
                  )}
                >
                  {parseISODate(date).getDate()}
                  {edited && (
                    <span className="absolute top-1 right-1 size-1.5 rounded-full bg-foreground/60" />
                  )}
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span>■ dark = taken</span>
            <span>light = part</span>
            <span>amber = missed or skipped</span>
            <span>grey = away</span>
            <span>• = fixed later</span>
          </div>

          {day && (
            <div className="space-y-2 rounded-xl bg-secondary p-3">
              <p className="text-sm font-medium">{formatShortDate(day)}</p>
              {item.slots.map((slot) => {
                const r = record(slot, day);
                const v = r?.status === "taken" ? "taken" : r ? "skipped" : null;
                return (
                  <div key={slot} className="flex items-center justify-between gap-2">
                    <span className="text-sm">{slotLabel(slot)}</span>
                    <div className="flex gap-1">
                      {(
                        [
                          ["taken", "Taken"],
                          ["skipped", "Skipped"],
                          [null, "Not logged"],
                        ] as const
                      ).map(([status, label]) => (
                        <button
                          key={label}
                          type="button"
                          aria-pressed={v === status}
                          onClick={() => setDoseRecord(item.id, slot, day, status)}
                          className={cn(
                            "min-h-9 rounded-full px-3 text-xs font-medium",
                            v === status ? "bg-primary text-primary-foreground" : "bg-card",
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section
          title="I was away"
          hint="On vacation or without your bottles? Mark the days in one go."
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="From">
              <Input
                type="date"
                value={away.from}
                max={today}
                onChange={(e) => e.target.value && setAway({ ...away, from: e.target.value })}
              />
            </Field>
            <Field label="To">
              <Input
                type="date"
                value={away.to}
                max={today}
                onChange={(e) => e.target.value && setAway({ ...away, to: e.target.value })}
              />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Chip on={away.all} onClick={() => setAway({ ...away, all: true })}>
              All supplements
            </Chip>
            <Chip on={!away.all} onClick={() => setAway({ ...away, all: false })}>
              Only {item.name}
            </Chip>
          </div>
          <Button variant="outline" className="w-full" onClick={applyAway}>
            <Plane /> Mark as skipped while away
          </Button>
        </Section>
      </div>
    </Screen>
  );
}
