import { Check, RotateCcw, Timer } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { EffectCheckIn } from "@/components/effect-check-in";
import { minutesUntil } from "@/components/reminders";
import { useNav } from "@/lib/nav";
import { clearDelivered } from "@/lib/notifications";
import { CATALOG_BY_ID } from "@/lib/catalog";
import {
  clusterNote,
  doseKey,
  nextSlot,
  planDay,
  type PlannedDose,
  type SlotPlan,
} from "@/lib/protocol";
import { daysOfStock, isLowStock, needsCheckIn, remainingKeys, ritualScore } from "@/lib/stats";
import { useSupplime } from "@/lib/store";
import type { DoseStatus } from "@/lib/types";
import { cn, formatClock, greeting, todayKey } from "@/lib/utils";

function statusFor(
  dose: PlannedDose,
  remaining: Set<string>,
  logs: { itemId: string; slot: string; status: DoseStatus }[],
) {
  if (remaining.has(doseKey(dose))) return "open";
  const log = logs.find((l) => l.itemId === dose.item.id && l.slot === dose.slot);
  return log?.status ?? "open";
}

export function TodayView({ onAdd, now }: { onAdd: () => void; now: number }) {
  const stack = useSupplime((s) => s.stack);
  const logs = useSupplime((s) => s.logs);
  const body = useSupplime((s) => s.body);
  const effects = useSupplime((s) => s.effects);
  const profile = useSupplime((s) => s.profile);
  const logDose = useSupplime((s) => s.logDose);
  const undoDose = useSupplime((s) => s.undoDose);
  const go = useNav((s) => s.go);
  const date = todayKey(new Date(now));
  const todayLogs = logs.filter((l) => l.date === date);
  // `now` is a dependency on purpose: due/upcoming status depends on the clock.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const plans = useMemo(() => planDay(stack, profile.slotTimes), [stack, profile.slotTimes, now]);
  const remaining = remainingKeys(stack, logs, date);
  const score = ritualScore(stack, logs, body, date);
  const checkIns = stack.filter((item) => needsCheckIn(item, effects, date)).slice(0, 2);
  const nxt = nextSlot(plans, remaining);
  const low = stack.filter((item) => !item.paused && isLowStock(item));
  const wait = nxt ? minutesUntil(nxt.time) : null;

  if (stack.length === 0) {
    return (
      <div className="mx-auto max-w-xl py-10">
        <p className="text-sm text-muted-foreground">{greeting()}</p>
        <h1 className="mt-2 font-display text-3xl tracking-tight">Your ritual is empty.</h1>
        <p className="mt-3 text-muted-foreground">
          Add Lion's Mane, L-Theanine, or anything you already take. Supplime will group them by
          meal and watch the bottle.
        </p>
        <Button className="mt-6" onClick={onAdd}>
          Add a supplement
        </Button>
      </div>
    );
  }

  const allDone = remaining.size === 0 && score.day.scheduled > 0;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">
          {greeting()}
          {profile.displayName ? `, ${profile.displayName}` : ""}
        </p>
        <div className="mt-1 flex items-end justify-between gap-4">
          <h1 className="font-display text-3xl tracking-tight">Today's ritual</h1>
          <div className="text-right">
            <p className="font-display text-3xl tabular-nums leading-none">{score.score}</p>
            <p className="text-xs text-muted-foreground">ritual score</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge variant="ok">{score.streak}-day streak</Badge>
          <Badge>
            {score.day.taken}/{score.day.scheduled} taken
          </Badge>
          {low.length > 0 && <Badge variant="warn">{low.length} running low</Badge>}
        </div>
        <Progress
          className="mt-4"
          value={score.day.scheduled ? (score.day.taken / score.day.scheduled) * 100 : 0}
        />
      </header>

      {allDone ? (
        <section className="rounded-xl bg-primary px-5 py-6 text-primary-foreground">
          <p className="font-display text-2xl tracking-tight">That's the day.</p>
          <p className="mt-2 text-sm text-primary-foreground/80">
            Every planned dose is logged. Keep the streak kind, not brittle — 80% still counts.
          </p>
        </section>
      ) : nxt ? (
        <section className="rounded-xl bg-card p-5 shadow-[var(--shadow-border)]">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium tracking-[0.16em] text-muted-foreground uppercase">
              Next window
            </p>
            <span className="inline-flex items-center gap-1 text-sm tabular-nums text-muted-foreground">
              <Timer className="size-3.5" />
              {wait == null
                ? nxt.slot.label
                : wait > 0
                  ? `in ${wait} min`
                  : wait > -90
                    ? "due now"
                    : "overdue"}
            </span>
          </div>
          <h2 className="mt-2 font-display text-2xl tracking-tight">
            {nxt.slot.label}
            <span className="ml-2 text-lg text-muted-foreground">{formatClock(nxt.time)}</span>
          </h2>
          {clusterNote(nxt.waves) && (
            <p className="mt-2 text-sm text-muted-foreground">{clusterNote(nxt.waves)}</p>
          )}
        </section>
      ) : null}

      {low.length > 0 && (
        <button
          type="button"
          onClick={() => go("stack")}
          className="block w-full rounded-xl bg-secondary px-4 py-3 text-left text-sm text-secondary-foreground"
        >
          <span className="font-medium">Order soon.</span>{" "}
          {low.map((i) => `${i.name} · ${daysOfStock(i)}d`).join(" · ")}
        </button>
      )}

      <div className="space-y-5">
        {plans.map((plan) => (
          <SlotBlock
            key={plan.slot.id}
            plan={plan}
            remaining={remaining}
            logs={todayLogs}
            onTake={(dose) => logDose(dose.item.id, dose.slot, "taken")}
            onTakeAll={(doses) => {
              for (const dose of doses) logDose(dose.item.id, dose.slot, "taken");
              void clearDelivered(plan.slot.id);
            }}
            onSkip={(dose) => logDose(dose.item.id, dose.slot, "skipped")}
            onUndo={(dose) => undoDose(dose.item.id, dose.slot)}
          />
        ))}
      </div>

      {checkIns.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-xl tracking-tight">Is it working?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You are near the usual onset window. A quick rating tells you when it kicked in and
              whether a dose step makes sense.
            </p>
          </div>
          {checkIns.map((item) => (
            <EffectCheckIn key={item.id} item={item} />
          ))}
        </section>
      )}
    </div>
  );
}

function SlotBlock({
  plan,
  remaining,
  logs,
  onTake,
  onTakeAll,
  onSkip,
  onUndo,
}: {
  plan: SlotPlan;
  remaining: Set<string>;
  logs: { itemId: string; slot: string; status: DoseStatus }[];
  onTake: (dose: PlannedDose) => void;
  onTakeAll: (doses: PlannedDose[]) => void;
  onSkip: (dose: PlannedDose) => void;
  onUndo: (dose: PlannedDose) => void;
}) {
  const open = plan.waves.flatMap((w) => w.doses).filter((d) => remaining.has(doseKey(d)));
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <h3 className="font-display text-lg tracking-tight">{plan.slot.label}</h3>
          <p className="text-xs tabular-nums text-muted-foreground">{formatClock(plan.time)}</p>
        </div>
        {open.length > 1 && (
          <Button size="sm" variant="outline" onClick={() => onTakeAll(open)}>
            <Check /> Take all {open.length}
          </Button>
        )}
      </div>
      <div className="space-y-3">
        {plan.waves.map((wave) => (
          <div key={wave.key} className="rounded-xl bg-card p-2 shadow-[var(--shadow-border)]">
            <div className="px-3 pt-2 pb-1">
              <p className="text-xs font-medium tracking-wide text-primary uppercase">
                {wave.title}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{wave.instruction}</p>
            </div>
            <div className="mt-1 space-y-1">
              {wave.doses.map((dose) => {
                const state = statusFor(dose, remaining, logs);
                const cat = dose.item.catalogId ? CATALOG_BY_ID[dose.item.catalogId] : undefined;
                return (
                  <div
                    key={doseKey(dose)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2",
                      state !== "open" && "opacity-70",
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{dose.item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {dose.item.amount} {dose.item.unit}
                        {cat?.onset.kind === "acute" && cat.onset.minutes
                          ? ` · feel in ${cat.onset.minutes.min}–${cat.onset.minutes.max} min`
                          : ""}
                      </p>
                    </div>
                    {state === "open" ? (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => onSkip(dose)}>
                          Skip
                        </Button>
                        <Button size="sm" onClick={() => onTake(dose)}>
                          Take
                        </Button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onUndo(dose)}
                        className="inline-flex h-11 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                      >
                        {state === "taken" ? (
                          <Check className="size-4 text-primary" />
                        ) : (
                          <RotateCcw className="size-3.5" />
                        )}
                        {state === "taken" ? "Taken" : "Skipped"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
