import { Check, Sparkles, Sun, Undo2, Watch } from "lucide-react";
import { useState } from "react";
import { TimeInput } from "@/components/fields";
import { Sheet } from "@/components/ui/screen";
import { detectWake } from "@/lib/health";
import { toast } from "sonner";
import { DayLog } from "@/components/day-log";
import { Button } from "@/components/ui/button";
import { doseLabel } from "@/lib/journey";
import { doseKey, type SlotPlan } from "@/lib/protocol";
import { rangeAdherence } from "@/lib/stats";
import { useSupplime } from "@/lib/store";
import type { DayContext, DoseLog, StackItem } from "@/lib/types";
import { addDays, cn, daysBetween, formatClock, formatHHMM, formatShortDate } from "@/lib/utils";

/**
 * The bottom line for today, above the fold: what you've done, what's left, how your
 * month is going, and your day (up time, coffee, meals, drinks) in one card.
 */
export function TodaySummary({
  date,
  plans,
  todayLogs,
  day,
  nowMin,
  wake,
}: {
  date: string;
  plans: SlotPlan[];
  todayLogs: DoseLog[];
  day?: DayContext;
  nowMin: number;
  wake: {
    show: boolean;
    wokeAt?: string;
    source?: DayContext["wakeSource"];
    shift: number;
    onSet: (at: string, source: "tap" | "watch") => void;
    onUndo: () => void;
  };
}) {
  const { stack, logs, profile } = useSupplime();
  const [wakeOpen, setWakeOpen] = useState(false);
  const doses = plans.flatMap((p) =>
    p.waves.flatMap((w) => w.doses.map((d) => ({ ...d, slotLabel: p.slot.label, time: p.time }))),
  );
  const statusOf = (d: (typeof doses)[number]) =>
    todayLogs.find((l) => l.itemId === d.item.id && l.slot === d.slot)?.status;
  const taken = doses.filter((d) => statusOf(d) === "taken").length;
  const left = doses.filter((d) => !statusOf(d) || statusOf(d) === "deferred");
  const total = doses.length;
  const pct = total ? taken / total : 0;
  const month = rangeAdherence(stack, logs, addDays(date, -30), addDays(date, -1));
  const since = profile.joinedAt ?? date;
  const allTaken = logs.filter((l) => l.status === "taken").length;

  return (
    <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
      <div className="flex items-center gap-4">
        <Ring pct={pct} label={`${taken}/${total}`} />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-tight tracking-tight">
            {total === 0
              ? "Nothing scheduled today"
              : taken === total
                ? "All doses taken"
                : `${taken} of ${total} doses taken`}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {left.length === 0
              ? total
                ? "Nothing left today. Nice."
                : ""
              : `Still to come: ${left
                  .slice(0, 3)
                  .map((d) => `${d.item.name} (${d.slotLabel.toLowerCase()})`)
                  .join(", ")}${left.length > 3 ? ` +${left.length - 3}` : ""}`}
          </p>
        </div>
      </div>

      {total > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Today's doses">
          {doses.map((d) => {
            const st = statusOf(d);
            return (
              <li
                key={doseKey(d)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs",
                  st === "taken"
                    ? "bg-primary text-primary-foreground"
                    : st === "skipped" || st === "missed"
                      ? "bg-warn/15 text-warn line-through"
                      : "bg-secondary text-secondary-foreground",
                )}
              >
                {st === "taken" && <Check className="size-3" />}
                {d.item.name}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Stat value={`Day ${daysBetween(since, date) + 1}`} label={`since ${formatShortDate(since)}`} />
        <Stat
          value={month.scheduled ? `${Math.round(month.rate * 100)}%` : "—"}
          label="last 30 days"
        />
        <Stat value={`${allTaken}`} label="doses taken" />
      </div>

      <div className="mt-3 space-y-3 border-t border-border pt-3">
        {wake.show ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Up yet? Your morning windows follow when you got up.
            </p>
            <Button size="sm" onClick={() => setWakeOpen(true)}>
              <Sun /> I'm up
            </Button>
          </div>
        ) : wake.wokeAt ? (
          <div className="flex items-center justify-between gap-3 text-sm">
            <button
              type="button"
              onClick={() => setWakeOpen(true)}
              className="min-w-0 text-left text-muted-foreground"
            >
              <Sun className="mr-1 inline size-3.5 align-[-2px]" />
              {wake.source === "inferred" ? "Up by " : "Up at "}
              <span className="font-medium text-foreground underline decoration-dotted underline-offset-2">
                {formatClock(wake.wokeAt)}
              </span>
              {wake.source === "watch"
                ? " (from your watch)"
                : wake.source === "inferred"
                  ? " (your first log). Tap to set the real time"
                  : ""}
              {Math.abs(wake.shift) >= 15 && wake.source !== "inferred"
                ? `. Morning windows moved ${fmtShift(wake.shift)} ${wake.shift > 0 ? "later" : "earlier"}`
                : ""}
              .
            </button>
            <button
              type="button"
              className="flex min-h-9 shrink-0 items-center gap-1 text-xs text-muted-foreground"
              onClick={wake.onUndo}
            >
              <Undo2 className="size-3.5" /> undo
            </button>
          </div>
        ) : null}
        {wakeOpen && (
          <WakeSheet
            nowMin={nowMin}
            usual={profile.rhythm.wake}
            watch={!!profile.healthSync?.enabled}
            onClose={() => setWakeOpen(false)}
            onPick={(at, source) => {
              wake.onSet(at, source);
              setWakeOpen(false);
            }}
          />
        )}
        <DayLog date={date} day={day} nowMin={nowMin} />
      </div>
    </section>
  );
}

/** "When did you get up?": now, a bit ago, your watch, or an exact time. */
function WakeSheet({
  nowMin,
  usual,
  watch,
  onClose,
  onPick,
}: {
  nowMin: number;
  usual: string;
  watch: boolean;
  onClose: () => void;
  onPick: (at: string, source: "tap" | "watch") => void;
}) {
  const wrap = (m: number) => ((m % 1440) + 1440) % 1440;
  const [exact, setExact] = useState(formatHHMM(wrap(nowMin)));
  const [checking, setChecking] = useState(false);
  const presets = [
    { label: "Just now", m: wrap(nowMin) },
    { label: "30 min ago", m: wrap(nowMin - 30) },
    { label: "1 h ago", m: wrap(nowMin - 60) },
    { label: "2 h ago", m: wrap(nowMin - 120) },
  ];
  return (
    <Sheet onClose={onClose} title="When did you get up?" description={`Usually ${formatClock(usual)}.`}>
      <div className="space-y-4">
        {watch && (
          <Button
            variant="outline"
            className="w-full"
            disabled={checking}
            onClick={async () => {
              setChecking(true);
              const woke = await detectWake();
              setChecking(false);
              if (woke) onPick(woke, "watch");
              else
                toast("No sleep from your watch yet", {
                  description: "Open the Fitbit app so it syncs, or pick a time below.",
                });
            }}
          >
            <Watch /> {checking ? "Checking…" : "Use my watch's wake time"}
          </Button>
        )}
        <div className="grid grid-cols-2 gap-2">
          {presets.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => onPick(formatHHMM(p.m), "tap")}
              className="rounded-xl border-2 border-border bg-card px-3 py-2 text-left text-sm"
            >
              <span className="block font-medium">{p.label}</span>
              <span className="block text-xs text-muted-foreground">
                {formatClock(formatHHMM(p.m))}
              </span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Exact time</span>
          <TimeInput value={exact} onChange={setExact} />
        </div>
        <Button className="w-full" onClick={() => onPick(exact, "tap")}>
          Up at {formatClock(exact)}
        </Button>
      </div>
    </Sheet>
  );
}

function fmtShift(m: number) {
  const a = Math.abs(m);
  const h = Math.floor(a / 60);
  const mm = a % 60;
  return h ? `${h}h${mm ? ` ${mm}m` : ""}` : `${mm}m`;
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-secondary px-2 py-2">
      <p className="font-display text-lg leading-tight tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function Ring({ pct, label }: { pct: number; label: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="7" className="stroke-muted" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          className="stroke-primary transition-[stroke-dashoffset] duration-500"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums">
        {label}
      </span>
    </div>
  );
}

/** Tomorrow's dose-up (or down) and today's first day at a new dose: make them feel special. */
export function DoseDayCards({ date, stack }: { date: string; stack: StackItem[] }) {
  const cancel = useSupplime((s) => s.cancelPendingDose);
  const tomorrow = addDays(date, 1);
  const upcoming = stack.filter((i) => i.pendingDose && i.pendingDose.date === tomorrow);
  const today = stack.filter(
    (i) => !i.archived && i.doseHistory.length > 1 && i.doseHistory.at(-1)!.date === date,
  );
  if (!upcoming.length && !today.length) return null;
  return (
    <div className="space-y-3">
      {today.map((i) => {
        const prev = i.doseHistory.at(-2)!;
        const up = i.amount > prev.amount;
        return (
          <section
            key={i.id}
            className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground animate-in fade-in-0 zoom-in-95"
          >
            <Sparkles className="absolute -top-2 -right-2 size-20 opacity-15" />
            <p className="text-xs font-medium tracking-[0.16em] uppercase opacity-80">
              {up ? "Dose-up day" : "New dose today"}
            </p>
            <p className="mt-1 font-display text-2xl tracking-tight">{i.name}</p>
            <p className="mt-1 text-sm opacity-90">
              {prev.amount} → <span className="font-semibold">{doseLabel(i, i.amount)}</span>{" "}
              from today. Day 1 of a new step: check in over the next weeks so you can tell whether
              the {up ? "extra" : "lower"} dose matters.
            </p>
          </section>
        );
      })}
      {upcoming.map((i) => (
        <section
          key={i.id}
          className="flex items-start gap-3 rounded-2xl border-2 border-dashed border-primary/50 bg-accent/40 p-4"
        >
          <Sparkles className="mt-0.5 size-5 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              Tomorrow: {i.name} {i.pendingDose!.kind === "step-up" ? "steps up" : "goes down"}
            </p>
            <p className="text-sm text-muted-foreground">
              {i.amount} → {doseLabel(i, i.pendingDose!.amount)}
              {i.pendingDose!.product ? ` with ${i.pendingDose!.product.brand}` : ""}. Today stays
              as it is.
            </p>
          </div>
          <button
            type="button"
            className="min-h-9 shrink-0 text-xs text-muted-foreground underline"
            onClick={() => {
              cancel(i.id);
              toast(`${i.name}: change cancelled`);
            }}
          >
            Cancel
          </button>
        </section>
      ))}
    </div>
  );
}
