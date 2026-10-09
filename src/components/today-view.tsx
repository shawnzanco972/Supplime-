import { AlarmClock, Check, Coffee, Flag, Sparkles, Undo2, Utensils, Wine } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import { DoseDayCards, TodaySummary } from "@/components/today-summary";
import { EffectCheckIn, SafetyCheck } from "@/components/effect-check-in";
import { FlagChip } from "@/components/flag-chip";
import { LevelCard } from "@/components/level-card";
import { Button } from "@/components/ui/button";
import { doseFlags } from "@/lib/flags";
import { gameSummary, milestonesReached, XP, bonusDay, type Quest } from "@/lib/game";
import { safetyDue } from "@/lib/advisor";
import { useNav } from "@/lib/nav";
import { clearDelivered } from "@/lib/notifications";
import {
  clusterNote,
  dayMinutes,
  doseKey,
  effectiveSlotTimes,
  logicalDate,
  nextSlot,
  nowInDay,
  planDay,
  type PlannedDose,
  type SlotPlan,
} from "@/lib/protocol";
import { daysOfStock, isLowStock, needsCheckIn, remainingKeys } from "@/lib/stats";
import { appToday, useSupplime } from "@/lib/store";
import { doseLabel } from "@/lib/journey";
import { WAKE_RELATIVE, type DoseLog } from "@/lib/types";
import { cn, formatClock, greeting } from "@/lib/utils";

export function TodayView({ now }: { now: number }) {
  const state = useSupplime();
  const { stack, logs, profile, days, effects } = state;
  const { go, open } = useNav();
  const nowDate = new Date(now);
  const date = logicalDate(nowDate, profile.rhythm);
  const nowMin = nowInDay(nowDate, profile.rhythm);
  const day = days.find((d) => d.date === date);
  const { times, shift, wokeAt, wakeSource } = effectiveSlotTimes(profile, days, date);
  const dayStack = stack.filter((i) => i.startedAt <= date);
  const plans = useMemo(
    () => planDay(dayStack, times, nowMin, profile.rhythm.wake),
    [dayStack, times, nowMin, profile.rhythm.wake],
  );
  const remaining = remainingKeys(stack, logs, date);
  const todayLogs = logs.filter((l) => l.date === date);
  const deferred = todayLogs.filter((l) => l.status === "deferred");
  const wakeM = profile.rhythm.wake;
  const events = (
    [
      ["coffee", day?.coffeeAt],
      ["meal", day?.mealsAt],
      ["drink", day?.alcoholAt],
    ] as const
  )
    .flatMap(([kind, list]) => (list ?? []).map((at) => ({ kind, at, m: dayMinutes(at, wakeM) })))
    .sort((a, b) => a.m - b.m);
  // Where each window sits on today's line: when you actually took it, else its planned time.
  const anchors: number[] = [];
  for (const plan of plans) {
    const taken = todayLogs
      .filter((l) => l.slot === plan.slot.id && l.status === "taken" && !l.edited)
      .map((l) => clockOf(l.at, wakeM));
    const m = taken.length ? Math.min(...taken) : plan.minutes;
    anchors.push(Math.max(m, anchors.at(-1) ?? -Infinity));
  }
  const game = useMemo(() => gameSummary(state, date), [state, date]);
  const nxt = nextSlot(plans, remaining, nowMin);
  const low = stack.filter((item) => !item.paused && !item.archived && isLowStock(item));
  const checkIns = stack.filter((item) => needsCheckIn(item, effects, date)).slice(0, 2);
  const safety = stack.find((item) => safetyDue(item, state.checks, date));
  const milestonesToday = milestonesReached(state, date).filter((m) => m.date === date);
  const active = stack.filter((i) => !i.archived);

  if (active.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <p className="text-sm text-muted-foreground">{greeting(nowDate)}</p>
        <h1 className="mt-2 font-display text-3xl tracking-tight">Your ritual is empty.</h1>
        <p className="mt-3 text-muted-foreground">
          Add what you take — from the guide, an iHerb link, or your own. Supplime groups them by
          meal and tells you how long each one should take to work.
        </p>
        <Button className="mt-6" onClick={() => open({ kind: "add" })}>
          Add a supplement
        </Button>
      </div>
    );
  }

  const takeAll = (doses: PlannedDose[], slotId: SlotPlan["slot"]["id"]) => {
    for (const dose of doses) state.logDose(dose.item.id, dose.slot, "taken", date);
    void clearDelivered(slotId);
    toast(`+${doses.length * XP.dose} XP`, {
      description: `${doses.length} dose${doses.length === 1 ? "" : "s"} logged.`,
    });
  };

  const showWake =
    !wokeAt &&
    plans.some((p) => WAKE_RELATIVE.includes(p.slot.id)) &&
    nowMin < dayMinutes(profile.slotTimes.lunch, profile.rhythm.wake);
  const allDone = game.quests[0]?.done;

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <header>
        <p className="text-sm text-muted-foreground">
          {greeting(nowDate)}
          {profile.displayName ? `, ${profile.displayName}` : ""}
        </p>
        <h1 className="mt-0.5 font-display text-3xl tracking-tight">Today</h1>
        {profile.why && <p className="mt-1 text-sm text-primary">“{profile.why}”</p>}
      </header>

      <TodaySummary
        date={date}
        plans={plans}
        todayLogs={todayLogs}
        day={day}
        nowMin={nowMin}
        wake={{
          show: showWake,
          wokeAt,
          shift,
          source: wakeSource,
          onSet: (at, source) => {
            state.setDay(date, { wokeAt: at, wakeSource: source });
            const delta =
              dayMinutes(at, profile.rhythm.wake) -
              dayMinutes(profile.slotTimes.wake, profile.rhythm.wake);
            toast(`Up at ${formatClock(at)}`, {
              description:
                Math.abs(delta) < 15
                  ? "Right on schedule."
                  : `Morning windows moved ${delta > 0 ? "+" : "−"}${fmtDelta(Math.abs(delta))}. Later ones stay on the clock.`,
            });
          },
          onUndo: () => state.setDay(date, { wokeAt: undefined, wakeSource: undefined }),
        }}
      />

      <DoseDayCards date={date} stack={stack} />

      <LevelCard game={game} compact onOpen={() => go("journey")} />

      <Quests quests={game.quests} onAction={(q) => questAction(q)} />

      {allDone ? (
        <DayComplete date={date} />
      ) : nxt ? (
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium opacity-80">Next window</p>
            <span className="inline-flex items-center gap-1 text-sm tabular-nums opacity-90">
              <AlarmClock className="size-3.5" />
              {untilLabel(nxt.minutes - nowMin)}
            </span>
          </div>
          <h2 className="mt-2 font-display text-2xl tracking-tight">
            {nxt.slot.label}
            <span className="ml-2 text-lg opacity-80">{formatClock(nxt.time)}</span>
          </h2>
          {clusterNote(nxt.waves) && (
            <p className="mt-1 text-sm opacity-85">{clusterNote(nxt.waves)}</p>
          )}
        </section>
      ) : null}

      {deferred.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-xl tracking-tight">Catch-ups</h2>
          {deferred.map((log) => (
            <CatchUpRow key={log.id} log={log} date={date} />
          ))}
        </section>
      )}

      {low.length > 0 && (
        <button
          type="button"
          onClick={() => go("stack")}
          className="block w-full rounded-2xl bg-secondary px-4 py-3 text-left text-sm text-secondary-foreground"
        >
          <span className="font-medium">Order soon.</span>{" "}
          {low.map((i) => `${i.name} · ${daysOfStock(i)}d`).join(" · ")}
        </button>
      )}

      <div className="space-y-5">
        {plans.map((plan, pi) => {
          // Coffee, meals and drinks you logged, placed by time between the windows.
          const anchor = (i: number) => anchors[i] ?? Infinity;
          const before = events.filter(
            (e) => e.m < anchor(pi) && (pi === 0 || e.m >= anchor(pi - 1)),
          );
          const openDoses = plan.waves
            .flatMap((w) => w.doses)
            .filter(
              (d) =>
                remaining.has(doseKey(d)) &&
                !deferred.some((l) => l.itemId === d.item.id && l.slot === d.slot),
            );
          return (
            <Fragment key={plan.slot.id}>
              {before.map((e) => (
                <EventRow key={`${e.kind}-${e.at}`} kind={e.kind} at={e.at} />
              ))}
              <section>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex items-baseline gap-2">
                    <h3 className="font-sans text-base font-semibold">{plan.slot.label}</h3>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      {formatClock(plan.time)}
                    </p>
                  </div>
                  {openDoses.length > 1 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => takeAll(openDoses, plan.slot.id)}
                    >
                      <Check /> Take all {openDoses.length}
                    </Button>
                  )}
                </div>
                <div className="space-y-3">
                  {plan.waves.map((wave) => (
                    <div
                      key={wave.key}
                      className="rounded-2xl bg-card p-2 shadow-[var(--shadow-border)]"
                    >
                      <div className="px-3 pt-2 pb-1">
                        <p className="text-xs font-medium text-primary">{wave.title}</p>
                      </div>
                      <div className="mt-1 space-y-1">
                        {wave.doses.map((dose) => (
                          <DoseRow
                            key={doseKey(dose)}
                            dose={dose}
                            log={todayLogs.find(
                              (l) => l.itemId === dose.item.id && l.slot === dose.slot,
                            )}
                            flags={doseFlags({
                              item: dose.item,
                              slot: dose.slot,
                              times,
                              profile,
                              stack,
                              day,
                            })}
                            late={nowMin > plan.minutes + 120}
                            onTake={(late) => {
                              state.logDose(
                                dose.item.id,
                                dose.slot,
                                "taken",
                                date,
                                late ? { late: true } : undefined,
                              );
                              const h = dose.item.doseHistory;
                              const first = h.length > 1 && h.at(-1)!.date === date;
                              toast(`+${late ? XP.lateDose : XP.dose} XP`, {
                                description: first
                                  ? `First dose at ${doseLabel(dose.item, dose.item.amount)}. New step, day 1.`
                                  : `${dose.item.name} logged.`,
                              });
                            }}
                            onNotNow={() =>
                              open({ kind: "not-now", itemId: dose.item.id, slot: dose.slot, date })
                            }
                            onSkip={() => {
                              state.logDose(dose.item.id, dose.slot, "skipped", date, {
                                reason: "chose",
                              });
                              toast(`${dose.item.name} skipped today`, {
                                description: "Logged honestly: +2 XP.",
                                action: {
                                  label: "Undo",
                                  onClick: () => state.undoDose(dose.item.id, dose.slot, date),
                                },
                              });
                            }}
                            onUndo={() => state.undoDose(dose.item.id, dose.slot, date)}
                            onOpen={() => open({ kind: "editor", itemId: dose.item.id })}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </Fragment>
          );
        })}
        {events
          .filter((e) => e.m >= (anchors.at(-1) ?? -Infinity))
          .map((e) => (
            <EventRow key={`${e.kind}-${e.at}`} kind={e.kind} at={e.at} />
          ))}
      </div>

      {milestonesToday.length > 0 && (
        <section className="space-y-2">
          {milestonesToday.map((m) => (
            <div
              key={`${m.itemId}-${m.key}`}
              className="flex items-start gap-3 rounded-2xl bg-accent p-4 text-accent-foreground animate-in fade-in-0 zoom-in-95"
            >
              <Flag className="mt-0.5 size-5 shrink-0" />
              <div>
                <p className="font-medium">
                  Milestone: {m.name} — {m.label.toLowerCase()} · +{XP.milestone} XP
                </p>
                <p className="text-sm opacity-85">{MILESTONE_NEXT[m.key] ?? ""}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {safety && (
        <section id="safety">
          <SafetyCheck item={safety} />
        </section>
      )}

      {checkIns.length > 0 && (
        <section className="space-y-3" id="check-ins">
          <div>
            <h2 className="font-display text-xl tracking-tight">Is it working?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You're near the usual onset. One tap a few times a week shows exactly when it kicked
              in.
            </p>
          </div>
          {checkIns.map((item) => (
            <EffectCheckIn key={item.id} item={item} />
          ))}
        </section>
      )}
    </div>
  );

  function questAction(q: Quest) {
    const a = q.action;
    if (!a) return;
    if (a.kind === "evaluate") open({ kind: "evaluate", itemId: a.itemId });
    else if (a.kind === "body") go("body");
    else if (a.kind === "check-in")
      document.getElementById("check-ins")?.scrollIntoView({ behavior: "smooth" });
    else if (a.kind === "insight") go("journey");
    else if (a.kind === "safety")
      document.getElementById("safety")?.scrollIntoView({ behavior: "smooth" });
  }
}

const timeOf = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

/** Minutes into your day for an ISO timestamp. */
function clockOf(iso: string, wake: string) {
  return dayMinutes(timeOf(iso), wake);
}

const EVENT = {
  coffee: { icon: Coffee, label: "Coffee" },
  meal: { icon: Utensils, label: "Meal" },
  drink: { icon: Wine, label: "Drink" },
} as const;

/** A coffee, meal or drink on today's line, between the windows. */
function EventRow({ kind, at }: { kind: keyof typeof EVENT; at: string }) {
  const { icon: Icon, label } = EVENT[kind];
  return (
    <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
      <span className="h-px flex-1 border-t border-dashed border-border" />
      <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1">
        <Icon className="size-3.5" />
        {label} · {formatClock(at)}
      </span>
      <span className="h-px flex-1 border-t border-dashed border-border" />
    </div>
  );
}

function fmtDelta(m: number) {
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return h ? `${h}h${mm ? ` ${mm}m` : ""}` : `${mm}m`;
}

function untilLabel(delta: number) {
  if (delta > 60) return `in ${fmtDelta(delta)}`;
  if (delta > 0) return `in ${delta} min`;
  if (delta > -90) return "due now";
  return "overdue";
}

function Quests({ quests, onAction }: { quests: Quest[]; onAction: (q: Quest) => void }) {
  return (
    <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
      <p className="text-xs font-medium text-muted-foreground">Today's three</p>
      <ul className="mt-2 space-y-1">
        {quests.map((q) => (
          <li key={q.id}>
            <button
              type="button"
              disabled={!q.action || q.done}
              onClick={() => onAction(q)}
              className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left disabled:cursor-default"
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                  q.done ? "border-primary bg-primary text-primary-foreground" : "border-border",
                )}
              >
                {q.done && <Check className="size-3.5" />}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    "block text-sm font-medium",
                    q.done && "text-muted-foreground line-through",
                  )}
                >
                  {q.title}
                </span>
                <span className="block text-xs text-muted-foreground">{q.detail}</span>
              </span>
              {q.xp > 0 && (
                <span className="shrink-0 text-xs font-medium text-primary tabular-nums">
                  +{q.xp}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function DayComplete({ date }: { date: string }) {
  const state = useSupplime();
  const game = gameSummary(state, date);
  const [justRevealed, setJustRevealed] = useState(false);
  const ins = game.insight;
  const bonus = bonusDay(date);
  return (
    <section className="space-y-3 rounded-2xl bg-primary p-5 text-primary-foreground">
      <div>
        <p className="font-display text-2xl tracking-tight">That's the day.</p>
        <p className="mt-1 text-sm opacity-85">
          +{XP.fullDay} XP for a complete day{bonus ? ` · lucky bonus +${XP.bonus}` : ""}.{" "}
          {game.streak > 1 ? `${game.streak} days in a row.` : ""}
        </p>
      </div>
      {ins.canUnlock && !justRevealed ? (
        <button
          type="button"
          onClick={() => {
            state.revealFact(ins.fact.id, date);
            setJustRevealed(true);
          }}
          className="flex w-full items-center gap-3 rounded-xl bg-primary-foreground/12 px-4 py-3 text-left"
        >
          <Sparkles className="size-5 shrink-0" />
          <span>
            <span className="block font-medium">Today's insight is ready</span>
            <span className="block text-xs opacity-80">Tap to reveal a new field note</span>
          </span>
        </button>
      ) : ins.unlocked || justRevealed ? (
        <div className="rounded-xl bg-primary-foreground/12 px-4 py-3 text-sm animate-in fade-in-0 zoom-in-95">
          <p className="text-xs opacity-75">
            Field note {ins.collected}/{ins.total}
          </p>
          <p className="mt-1">{ins.fact.text}</p>
        </div>
      ) : null}
    </section>
  );
}

function CatchUpRow({ log, date }: { log: DoseLog; date: string }) {
  const item = useSupplime((s) => s.stack.find((i) => i.id === log.itemId));
  const logDose = useSupplime((s) => s.logDose);
  if (!item) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-[var(--shadow-border)]">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          {log.reason === "not-with-me" ? "When you're home" : "Later"} · reminder{" "}
          {log.remindAt ? formatClock(log.remindAt) : ""}
          {item.foodTiming === "with" ? " · with food" : ""}
        </p>
      </div>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => logDose(item.id, log.slot, "skipped", date, { reason: log.reason })}
      >
        Skip
      </Button>
      <Button
        size="sm"
        onClick={() => {
          logDose(item.id, log.slot, "taken", date, { late: true, reason: log.reason });
          toast(`+${XP.lateDose} XP`, { description: "Caught up. Nice." });
        }}
      >
        Took it
      </Button>
    </div>
  );
}

function DoseRow({
  dose,
  log,
  flags,
  late,
  onTake,
  onNotNow,
  onSkip,
  onUndo,
  onOpen,
}: {
  dose: PlannedDose;
  log?: DoseLog;
  flags: ReturnType<typeof doseFlags>;
  late: boolean;
  onTake: (late: boolean) => void;
  onNotNow: () => void;
  onSkip: () => void;
  onUndo: () => void;
  onOpen: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const status = log?.status;
  const h = dose.item.doseHistory;
  const newDose = h.length > 1 && h.at(-1)!.date === appToday();
  const done = status === "taken" || status === "skipped" || status === "missed";
  const shown = showAll ? flags : flags.slice(0, flags[0]?.tone === "warn" ? 2 : 1);
  return (
    <div className={cn("rounded-xl px-3 py-2", done && "opacity-70")}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="truncate font-medium">
            {dose.item.name}
            {newDose && (
              <span className="ml-2 inline-flex items-center gap-0.5 rounded-full bg-primary px-2 py-0.5 align-middle text-[10px] font-semibold text-primary-foreground">
                <Sparkles className="size-3" /> New dose
              </span>
            )}
          </p>
          <p className={cn("text-xs text-muted-foreground", newDose && "font-medium text-primary")}>
            {doseLabel(dose.item, dose.item.amount)}
          </p>
        </button>
        {status === "deferred" ? (
          <div className="flex shrink-0 items-center gap-1">
            <span className="text-xs text-muted-foreground">
              catch-up {log?.remindAt ? formatClock(log.remindAt) : ""}
            </span>
            <button
              type="button"
              onClick={onUndo}
              aria-label={`Undo ${dose.item.name}`}
              className="inline-flex h-11 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Undo2 className="size-3.5" /> Undo
            </button>
          </div>
        ) : !done ? (
          <div className="flex shrink-0 gap-0.5">
            <Button size="sm" variant="ghost" className="px-2.5" onClick={onSkip}>
              Skip
            </Button>
            <Button size="sm" variant="ghost" className="px-2.5" onClick={onNotNow}>
              Later
            </Button>
            <Button size="sm" onClick={() => onTake(late)}>
              Take
            </Button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-1">
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs font-medium",
                status === "taken" ? "text-primary" : "text-muted-foreground",
              )}
            >
              {status === "taken" && <Check className="size-4" />}
              {status === "taken" ? (log?.late ? "Taken late" : "Taken") : "Skipped"}
              {status === "taken" && log && !log.edited && !log.backfill
                ? ` ${formatClock(timeOf(log.at))}`
                : ""}
            </span>
            <button
              type="button"
              onClick={onUndo}
              aria-label={`Undo ${dose.item.name}`}
              className="inline-flex h-11 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-secondary hover:text-foreground"
            >
              <Undo2 className="size-3.5" /> Undo
            </button>
          </div>
        )}
      </div>
      {!done && shown.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {shown.map((f) => (
            <FlagChip key={f.text} flag={f} />
          ))}
          {flags.length > shown.length && (
            <button
              type="button"
              className="text-xs text-muted-foreground underline"
              onClick={() => setShowAll(true)}
            >
              +{flags.length - shown.length} more
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const MILESTONE_NEXT: Record<string, string> = {
  "first-signs":
    "From today some people start noticing it. Check in every few days so you catch the moment.",
  typical:
    "Most people feel it by now. If you don't yet, that's useful information — check in today.",
  "dose-review":
    "You've given this dose a fair run. If it isn't doing enough, a step up is now allowed.",
};
