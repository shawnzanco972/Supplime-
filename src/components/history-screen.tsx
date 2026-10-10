import { ChevronLeft, ChevronRight, Plane } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Chip, Field, Section } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { cellFor, type Cell } from "@/lib/insights";
import { useNav } from "@/lib/nav";
import { appToday, useSupplime } from "@/lib/store";
import { SLOTS, type SlotId } from "@/lib/types";
import { addDays, cn, formatClock, formatShortDate, parseISODate } from "@/lib/utils";

const CELL: Record<Cell, string> = {
  taken: "bg-primary text-primary-foreground",
  partial: "bg-primary/45 text-foreground",
  missed: "bg-warn/40 text-foreground",
  away: "bg-muted-foreground/25",
  open: "border border-dashed border-muted-foreground/40",
  none: "text-muted-foreground/50",
};
const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];
/** Which six-week page a date falls on (0 = the one ending this week). */
function pageOf(date: string, today: string) {
  const start = addDays(today, -((parseISODate(today).getDay() + 6) % 7) - 35);
  return date >= start ? 0 : Math.ceil((daysBetweenInclusive(date, start) - 1) / 42);
}

const daysBetweenInclusive = (a: string, b: string) =>
  Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 864e5) + 1;
const slotLabel = (id: SlotId) => SLOTS.find((s) => s.id === id)?.label ?? id;

/**
 * Fix your record: tap any day of the last 6 weeks to mark each dose taken or skipped,
 * or mark a whole trip as "away". Pills left follow your changes.
 */
export function HistoryScreen({ itemId, date }: { itemId?: string; date?: string }) {
  const close = useNav((s) => s.close);
  const openOverlay = useNav((s) => s.open);
  const { stack, logs, setDoseRecord, markAway, fillDays } = useSupplime();
  const today = appToday();
  const items = stack.filter((i) => !i.planned && i.startedAt <= today);
  const [selected, setSelected] = useState(itemId ?? items[0]?.id);
  const item = items.find((i) => i.id === selected) ?? items[0];
  const [day, setDay] = useState<string | null>(date ?? null);
  const [away, setAway] = useState({ from: addDays(today, -7), to: addDays(today, -1), all: true });
  // Pages of six weeks: 0 = ending this week, 1 = the six before, …
  const [page, setPage] = useState(() => (date ? pageOf(date, today) : 0));

  // Long-press a day to pick several, then fix them in one go.
  const [picked, setPicked] = useState<string[] | null>(null);
  const press = useRef<{ timer: number; fired: boolean } | null>(null);

  // Six weeks, Monday first.
  const weeks = useMemo(() => {
    const dow = (parseISODate(today).getDay() + 6) % 7;
    const start = addDays(today, -dow - 35 - page * 42);
    return Array.from({ length: 6 }, (_, w) =>
      Array.from({ length: 7 }, (_, d) => addDays(start, w * 7 + d)),
    );
  }, [today, page]);

  if (!item) {
    return (
      <Screen onClose={close} title="History">
        <p className="text-sm text-muted-foreground">Nothing to show yet.</p>
      </Screen>
    );
  }

  // Morning first, whatever order the windows were picked in.
  const slots = SLOTS.map((x) => x.id).filter((id) => item.slots.includes(id));

  const startPress = (date: string) => {
    if (press.current) window.clearTimeout(press.current.timer);
    const p = { fired: false, timer: 0 };
    p.timer = window.setTimeout(() => {
      p.fired = true;
      navigator.vibrate?.(15);
      setDay(null);
      setPicked((prev) => (prev ? (prev.includes(date) ? prev : [...prev, date]) : [date]));
    }, 450);
    press.current = p;
  };
  const endPress = () => {
    if (press.current) window.clearTimeout(press.current.timer);
  };
  const tapDay = (date: string) => {
    if (press.current?.fired) {
      press.current = null;
      return;
    }
    if (picked) {
      const next = picked.includes(date) ? picked.filter((d) => d !== date) : [...picked, date];
      setPicked(next.length ? next : null);
    } else setDay(date);
  };
  const range = picked && picked.length > 1 ? [...picked].sort() : null;
  const fillRange = () => {
    if (!range) return;
    const out: string[] = [];
    for (let d = range[0]!; d <= range.at(-1)! && d <= today; d = addDays(d, 1)) out.push(d);
    setPicked(out);
  };
  const applyPicked = (status: "taken" | "skipped" | "away" | null) => {
    if (!picked) return;
    const before = { logs: useSupplime.getState().logs, stack: useSupplime.getState().stack };
    fillDays(item.id, picked, status);
    const n = picked.length;
    toast(
      `${n} day${n === 1 ? "" : "s"} ${status === "taken" ? "marked taken" : status === "away" ? "marked away" : status ? "marked skipped" : "cleared"}`,
      {
        description: picked.some((d) => d < item.startedAt)
          ? "Start date moved back to match."
          : undefined,
        action: { label: "Undo", onClick: () => useSupplime.setState(before) },
      },
    );
    setPicked(null);
  };

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

        <button
          type="button"
          onClick={() => openOverlay({ kind: "times", itemId: item.id })}
          className="text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          See what time you took them →
        </button>

        <Section
          title={item.name}
          hint="Tap a day to change it. Hold a day to pick several and fix them together. Fixes count as history: they keep your record honest but don't earn full XP."
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setPage(page + 1)}
              className="flex min-h-9 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground hover:bg-secondary"
            >
              <ChevronLeft className="size-4" /> Earlier
            </button>
            <span className="text-xs font-medium tabular-nums">
              {formatShortDate(weeks[0]![0]!)} –{" "}
              {formatShortDate(weeks[5]![6]! > today ? today : weeks[5]![6]!)}
            </span>
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              className="flex min-h-9 items-center gap-1 rounded-full px-2 text-xs text-muted-foreground hover:bg-secondary disabled:opacity-0"
            >
              Later <ChevronRight className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center select-none" role="grid">
            {WEEKDAYS.map((w, i) => (
              <span key={i} className="text-[11px] text-muted-foreground">
                {w}
              </span>
            ))}
            {weeks.flat().map((date) => {
              const future = date > today;
              const c = future ? "none" : cellFor(item, logs, date, today);
              const edited = logs.some((l) => l.itemId === item.id && l.date === date && l.edited);
              const before = date < item.startedAt;
              const on = picked?.includes(date);
              return (
                <button
                  key={date}
                  type="button"
                  disabled={future}
                  onClick={() => tapDay(date)}
                  onPointerDown={() => startPress(date)}
                  onPointerUp={endPress}
                  onPointerLeave={endPress}
                  onPointerCancel={endPress}
                  onContextMenu={(e) => e.preventDefault()}
                  aria-label={`${formatShortDate(date)}: ${before ? "before you started" : c}`}
                  aria-pressed={picked ? !!on : undefined}
                  className={cn(
                    "relative flex aspect-square items-center justify-center rounded-lg text-xs tabular-nums disabled:opacity-30",
                    CELL[c],
                    before && !on && "opacity-45",
                    (day === date || on) && "ring-2 ring-foreground ring-offset-1 ring-offset-card",
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

          {picked && (
            <div className="space-y-2 rounded-xl bg-secondary p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">
                  {picked.length} day{picked.length === 1 ? "" : "s"} picked
                </p>
                <button
                  type="button"
                  onClick={() => setPicked(null)}
                  className="min-h-9 px-2 text-xs text-muted-foreground underline"
                >
                  Cancel
                </button>
              </div>
              {range && range.length < daysBetweenInclusive(range[0]!, range.at(-1)!) && (
                <button
                  type="button"
                  onClick={fillRange}
                  className="text-xs text-primary underline underline-offset-2"
                >
                  Pick every day from {formatShortDate(range[0]!)} to{" "}
                  {formatShortDate(range.at(-1)!)}
                </button>
              )}
              <div className="grid grid-cols-4 gap-1">
                {(
                  [
                    ["taken", "Taken"],
                    ["skipped", "Skipped"],
                    ["away", "Away"],
                    [null, "Clear"],
                  ] as const
                ).map(([status, label]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => applyPicked(status)}
                    className={cn(
                      "min-h-9 rounded-full px-2 text-xs font-medium",
                      status === "taken" ? "bg-primary text-primary-foreground" : "bg-card",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {day && !picked && (
            <div className="space-y-2 rounded-xl bg-secondary p-3">
              <p className="text-sm font-medium">
                {formatShortDate(day)}
                {day < item.startedAt && (
                  <span className="font-normal text-muted-foreground">
                    {" "}
                    · before your start date (marking it moves the start back)
                  </span>
                )}
              </p>
              {slots.map((slot) => {
                const r = record(slot, day);
                const v = r?.status === "taken" ? "taken" : r ? "skipped" : null;
                // The time you logged it, when you used the app that day.
                const at =
                  r?.status === "taken" && !r.edited && !r.backfill ? new Date(r.at) : null;
                return (
                  <div key={slot} className="flex items-center justify-between gap-2">
                    <span className="text-sm">
                      {slotLabel(slot)}
                      {at && !Number.isNaN(at.getTime()) && (
                        <span className="block text-xs text-muted-foreground tabular-nums">
                          logged{" "}
                          {formatClock(
                            `${String(at.getHours()).padStart(2, "0")}:${String(at.getMinutes()).padStart(2, "0")}`,
                          )}
                        </span>
                      )}
                    </span>
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
