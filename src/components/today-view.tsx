import { AlarmClock, Check, Flag, Sparkles, Sun, Undo2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DayLog } from "@/components/day-log";
import { EffectCheckIn, SafetyCheck } from "@/components/effect-check-in";
import { FlagChip } from "@/components/flag-chip";
import { LevelCard } from "@/components/level-card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { useSupplime } from "@/lib/store";
import { WAKE_RELATIVE, type DoseLog } from "@/lib/types";
import { cn, formatClock, formatHHMM, greeting } from "@/lib/utils";

export function TodayView({ now }: { now: number }) {
  const state = useSupplime();
  const { stack, logs, profile, days, effects } = state;
  const { go, open } = useNav();
  const nowDate = new Date(now);
  const date = logicalDate(nowDate, profile.rhythm);
  const nowMin = nowInDay(nowDate, profile.rhythm);
  const day = days.find((d) => d.date === date);
  const { times, shift, wokeAt } = effectiveSlotTimes(profile, days, date);
  const dayStack = stack.filter((i) => i.startedAt <= date);
  const plans = useMemo(
    () => planDay(dayStack, times, nowMin, profile.rhythm.wake),
    [dayStack, times, nowMin, profile.rhythm.wake],
  );
  const remaining = remainingKeys(stack, logs, date);
  const todayLogs = logs.filter((l) => l.date === date);
  const deferred = todayLogs.filter((l) => l.status === "deferred");
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
        {profile.why && <p className="mt-1 text-sm text-primary italic">“{profile.why}”</p>}
      </header>

      <LevelCard game={game} compact onOpen={() => go("journey")} />

      {/* Your day: wake time and today's coffee/drinks */}
      <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
        {showWake ? (
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="font-medium">Up yet?</p>
              <p className="text-sm text-muted-foreground">
                Tap when you get up and your morning windows move with you.
              </p>
            </div>
            <Button
              onClick={() => {
                const at = formatHHMM(nowMin);
                state.setDay(date, { wokeAt: at });
                const delta = nowMin - dayMinutes(profile.slotTimes.wake, profile.rhythm.wake);
                toast("Good morning", {
                  description:
                    Math.abs(delta) < 15
                      ? "Right on schedule."
                      : `Morning plan moved ${delta > 0 ? "+" : "−"}${fmtDelta(Math.abs(delta))}.`,
                });
              }}
            >
              <Sun /> I'm up
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="text-muted-foreground">
              {wokeAt ? (
                <>
                  Up at <span className="font-medium text-foreground">{formatClock(wokeAt)}</span>
                  {Math.abs(shift) >= 15 &&
                    ` · plan ${shift > 0 ? "+" : "−"}${fmtDelta(Math.abs(shift))}`}
                </>
              ) : (
                <>
                  Your day: up {formatClock(profile.rhythm.wake)}, bed{" "}
                  {formatClock(profile.rhythm.bed)}
                </>
              )}
            </p>
            {wokeAt && (
              <button
                type="button"
                className="flex min-h-9 items-center gap-1 text-xs text-muted-foreground"
                onClick={() => state.setDay(date, { wokeAt: undefined })}
              >
                <Undo2 className="size-3.5" /> undo
              </button>
            )}
          </div>
        )}
        <div className="mt-3 border-t border-border pt-3">
          <DayLog date={date} day={day} nowMin={nowMin} />
        </div>
      </section>

      <Quests quests={game.quests} onAction={(q) => questAction(q)} />

      {allDone ? (
        <DayComplete date={date} />
      ) : nxt ? (
        <section className="rounded-2xl bg-primary p-5 text-primary-foreground">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium tracking-[0.16em] uppercase opacity-80">
              Next window
            </p>
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
        {plans.map((plan) => {
          const openDoses = plan.waves
            .flatMap((w) => w.doses)
            .filter(
              (d) =>
                remaining.has(doseKey(d)) &&
                !deferred.some((l) => l.itemId === d.item.id && l.slot === d.slot),
            );
          return (
            <section key={plan.slot.id}>
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="flex items-baseline gap-2">
                  <h3 className="font-display text-lg tracking-tight">{plan.slot.label}</h3>
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
                      <p className="text-xs font-medium tracking-wide text-primary uppercase">
                        {wave.title}
                      </p>
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
                            toast(`+${late ? XP.lateDose : XP.dose} XP`, {
                              description: `${dose.item.name} logged.`,
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
          );
        })}
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
      <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
        Today's three
      </p>
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
          <p className="text-xs tracking-wide uppercase opacity-75">
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
  const done = status === "taken" || status === "skipped" || status === "missed";
  const shown = showAll ? flags : flags.slice(0, flags[0]?.tone === "warn" ? 2 : 1);
  return (
    <div className={cn("rounded-xl px-3 py-2", done && "opacity-70")}>
      <div className="flex items-center gap-3">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="truncate font-medium">{dose.item.name}</p>
          <p className="text-xs text-muted-foreground">
            {dose.item.amount} {dose.item.unit}
            {dose.item.servingLabel ? ` · ${dose.item.servingLabel}` : ""}
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
