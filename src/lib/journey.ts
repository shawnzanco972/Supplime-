import { nextStep, pillsFor, profileFor, unitStrength } from "./knowledge";
import { capsuleSwap, type Swap } from "./swap";
import { currentStep, daysAtDose, daysOn, effectHistory, firstFelt, latestEffect } from "./stats";
import type { Decision, DecisionKind, DoseLog, EffectLog, StackItem } from "./types";
import { addDays, daysBetween, formatShortDate, todayKey } from "./utils";

export type MilestoneKey = "start" | "first-signs" | "typical" | "dose-review" | "evaluate";

export type Milestone = {
  key: MilestoneKey;
  /** Day number on this supplement (day 1 = start date). */
  day: number;
  date: string;
  label: string;
  detail: string;
  reached: boolean;
};

export type Phase =
  | "offtrack"
  | "building"
  | "window"
  | "working"
  | "review"
  | "evaluate"
  | "holding"
  | "stopped";

export type Recommendation = {
  kind: DecisionKind;
  title: string;
  why: string;
  to?: number;
  /** The step needs a different-strength bottle. */
  swap?: Swap;
};

export type Journey = ReturnType<typeof journeyFor>;

/**
 * The supplement's own clock: days you actually took it. Missed and away days don't move it
 * (a day you didn't take something doesn't build anything up). Days before you started
 * logging count as taken, and today counts while it's still open.
 */
export function effectiveClock(item: StackItem, logs: DoseLog[], from: string, today: string) {
  const mine = logs.filter((l) => l.itemId === item.id);
  const taken = new Set(mine.filter((l) => l.status === "taken").map((l) => l.date));
  const resolved = new Set(
    mine.filter((l) => l.status === "skipped" || l.status === "missed").map((l) => l.date),
  );
  const firstLog = mine.map((l) => l.date).sort()[0];
  const reached: string[] = [];
  let n = 0;
  for (let d = from; d <= today; d = addDays(d, 1)) {
    const counts = !firstLog || d < firstLog || taken.has(d) || (d === today && !resolved.has(d));
    if (counts) reached[++n] = d;
  }
  return {
    days: n,
    /** The date you reached (or, taking it daily from now, will reach) day `k`. */
    dateOf: (k: number) => (k <= n ? (reached[Math.max(1, k)] ?? from) : addDays(today, k - n)),
  };
}

/** After "give it more time": this many days in a row before the next check. */
export const STREAK_GOAL = 14;

/**
 * Days in a row you've taken it, counting back from today (or yesterday while today is
 * still open). Away days pause the run without breaking it; a missed or skipped day ends
 * it. Days before you started logging count, like on the main clock.
 */
export function streakFor(item: StackItem, logs: DoseLog[], today: string, since?: string) {
  const mine = logs.filter((l) => l.itemId === item.id);
  const taken = new Set(mine.filter((l) => l.status === "taken").map((l) => l.date));
  const away = new Set(mine.filter((l) => l.away).map((l) => l.date));
  const firstLog = mine.map((l) => l.date).sort()[0];
  const floor = since && since > item.startedAt ? since : item.startedAt;
  let run = 0;
  for (let d = taken.has(today) ? today : addDays(today, -1); d >= floor; d = addDays(d, -1)) {
    if (taken.has(d) || !firstLog || d < firstLog) run++;
    else if (!away.has(d)) break;
  }
  return { run, todayTaken: taken.has(today) };
}

/**
 * The full "how long" picture for one supplement: where you are on its timeline,
 * what comes next, whether it is time to change the dose or decide if it is worth
 * keeping, and what Supplime would recommend.
 */
export function journeyFor(input: {
  item: StackItem;
  logs: DoseLog[];
  effects: EffectLog[];
  decisions: Decision[];
  today?: string;
}) {
  const { item, logs, effects, decisions } = input;
  const today = input.today ?? todayKey();
  const p = profileFor(item);
  const step = currentStep(item);
  const stepStart = step.date > item.startedAt ? step.date : item.startedAt;
  // Everything runs on days you actually took it, not calendar days.
  const calendarDay = daysOn(item, today);
  const clock = effectiveClock(item, logs, item.startedAt, today);
  const doseClock = effectiveClock(item, logs, stepStart, today);
  const day = Math.max(1, clock.days);
  const atDose = Math.max(item.startedAt < today ? 1 : 0, doseClock.days);
  const calendarAtDose = daysAtDose(item, today);
  const stepStartDay = daysBetween(item.startedAt, stepStart) + 1;

  // How consistently you took it at the current dose (since you started logging it).
  const mine = logs.filter(
    (l) => l.itemId === item.id && l.status === "taken" && l.date >= stepStart,
  );
  const takenDates = new Set(mine.map((l) => l.date));
  const firstLog = [...takenDates].sort()[0];
  const trackedFrom = firstLog && firstLog > stepStart ? firstLog : stepStart;
  // Days you were away count as a pause, not as misses.
  const awayDates = new Set(
    logs
      .filter(
        (l) => l.itemId === item.id && l.away && l.date >= trackedFrom && !takenDates.has(l.date),
      )
      .map((l) => l.date),
  );
  const trackedDays = firstLog
    ? Math.max(0, daysBetween(trackedFrom, today) + 1 - awayDates.size)
    : 0;
  const consistency = trackedDays > 0 ? Math.min(1, takenDates.size / trackedDays) : null;

  const felt = firstFelt(item, effects);
  const last = latestEffect(item, effects);
  const recentSide = effectHistory(item, effects)
    .slice(-3)
    .some((e) => e.sideEffects && daysBetween(e.date, today) <= 14);

  const itemDecisions = decisions
    .filter((d) => d.itemId === item.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  const lastDecision = itemDecisions.at(-1);

  const streak = streakFor(item, logs, today);
  // "More time" means two weeks in a row, not two weeks on the calendar: a missed day
  // restarts the count (away days just pause it).
  const run =
    lastDecision?.kind === "more-time" ? streakFor(item, logs, today, lastDecision.date) : null;
  const streakGoal = run
    ? { goal: STREAK_GOAL, done: Math.min(STREAK_GOAL, run.run), since: lastDecision!.date }
    : null;

  // When is the next "keep or not" verdict due?
  const baseEval = clock.dateOf(p.evaluateDay);
  let nextEval = baseEval;
  // Does the streak set the date, or is the verdict day later anyway?
  let streakSetsDate = false;
  if (run) {
    const left = STREAK_GOAL - run.run;
    const after = left <= 0 ? today : addDays(today, run.todayTaken ? left : left - 1);
    streakSetsDate = after >= baseEval;
    nextEval = after > baseEval ? after : baseEval;
  } else if (lastDecision) {
    const wait =
      lastDecision.kind === "keep"
        ? 60
        : lastDecision.kind === "step-up" || lastDecision.kind === "lower"
          ? Math.max(p.minDaysBeforeIncrease, 14)
          : 9999;
    const after = addDays(lastDecision.date, wait);
    nextEval = after > baseEval ? after : baseEval;
  }
  const doseReviewDate = doseClock.dateOf(p.minDaysBeforeIncrease);
  const evaluateDue = !item.archived && today >= nextEval;
  const doseReviewOpen = atDose >= p.minDaysBeforeIncrease;
  // You already decided and the next check isn't due: no nagging, no repeat verdicts.
  const holding =
    !!lastDecision &&
    !evaluateDue &&
    (lastDecision.kind === "keep" || lastDecision.kind === "more-time") &&
    today < nextEval;
  // You changed the dose today: you can still revise it freely until you take it.
  const changedToday = step.date === today && item.doseHistory.length > 1 && item.startedAt < today;
  const previousStep = changedToday ? item.doseHistory.at(-2) : undefined;

  const dateOf = (d: number) => clock.dateOf(d);
  // Effective day numbers for calendar dates (past: as counted; future: daily from now).
  const effDayOn = (date: string) =>
    date > today
      ? day + daysBetween(today, date)
      : Math.max(1, effectiveClock(item, logs, item.startedAt, date).days);
  const stepStartEff =
    stepStart > item.startedAt
      ? effectiveClock(item, logs, item.startedAt, addDays(stepStart, -1)).days
      : 0;
  const milestones: Milestone[] = [
    {
      key: "start",
      day: 1,
      date: item.startedAt,
      label: "Started",
      detail: `Day 1 at ${item.doseHistory[0]?.amount ?? item.amount} ${item.unit}`,
      reached: true,
    },
    {
      key: "first-signs",
      day: p.firstSignsDay,
      date: dateOf(p.firstSignsDay),
      label: p.kind === "acute" ? "Can work from the first dose" : "First signs possible",
      detail:
        p.kind === "acute" && p.minutes
          ? `Usually ${p.minutes.min}–${p.minutes.max} min after a dose`
          : `Some people notice something from day ${p.firstSignsDay}`,
      reached: day >= p.firstSignsDay,
    },
    {
      key: "typical",
      day: p.typicalDay,
      date: dateOf(p.typicalDay),
      label: "Most people feel it",
      detail: `Typical onset around day ${p.typicalDay} (range ${p.firstSignsDay}–${p.windowEndDay})`,
      reached: day >= p.typicalDay,
    },
    {
      key: "dose-review",
      day: stepStartEff + p.minDaysBeforeIncrease,
      date: doseReviewDate,
      label: "Dose change unlocks",
      detail: `Give each dose at least ${p.minDaysBeforeIncrease} days before changing it`,
      reached: doseReviewOpen,
    },
    {
      key: "evaluate",
      day: effDayOn(nextEval),
      date: nextEval,
      label:
        streakGoal && streakSetsDate
          ? `${STREAK_GOAL} days in a row`
          : streakGoal
            ? "Verdict day"
            : lastDecision
              ? "Next check"
              : "Verdict day",
      detail: streakGoal
        ? `${streakGoal.done} of ${STREAK_GOAL} days in a row so far. A missed day starts the count again; away days don't.`
        : "Decide: keep, adjust the dose, or stop",
      reached: evaluateDue,
    },
  ];
  milestones.sort((a, b) => a.day - b.day);
  const next = milestones.find((m) => !m.reached) ?? null;

  const working = !!last && last.rating >= 2 && !recentSide;
  // Taken on fewer than half the days: nothing about it can be judged yet.
  // A week in a row (or a few days into a "more time" run) puts you back on track.
  const offTrack =
    consistency !== null &&
    trackedDays >= 7 &&
    consistency < 0.5 &&
    streak.run < 7 &&
    !(streakGoal && streakGoal.done >= 3);
  let phase: Phase;
  if (item.archived) phase = "stopped";
  else if (offTrack && !item.pendingDose) phase = "offtrack";
  else if (evaluateDue) phase = "evaluate";
  else if (holding || changedToday || item.pendingDose) phase = "holding";
  else if (working) phase = "working";
  else if (day >= p.firstSignsDay)
    phase = doseReviewOpen && day >= p.typicalDay ? "review" : "window";
  else phase = "building";

  const pd = item.pendingDose;
  const recommendation: Recommendation =
    offTrack && !pd
      ? {
          kind: "more-time",
          title: "Not on track",
          why: `Taken on ${takenDates.size} of ${trackedDays} days, so its clock is at day ${day}, not day ${calendarDay}. Nothing can be judged until you take it most days${lastDecision?.kind === "more-time" ? `: the extra time you gave it needs ${STREAK_GOAL} days in a row` : ""}.`,
        }
      : pd
        ? {
            kind: "keep",
            title: `${pd.kind === "step-up" ? "Stepping up" : "Lowering"} to ${trimNum(pd.amount)} ${item.unit} on ${formatShortDate(pd.date)}`,
            why: `Today stays at ${doseLabel(item, item.amount)}. Your new dose starts ${pd.date === addDays(today, 1) ? "tomorrow" : formatShortDate(pd.date)}.`,
          }
        : changedToday
          ? {
              kind: "keep",
              title: `New dose: ${doseLabel(item, item.amount)} from today`,
              why: `Changed today, so you can still adjust it without penalty. The next dose review opens ${formatShortDate(doseReviewDate)}.`,
            }
          : holding && lastDecision
            ? {
                kind: lastDecision.kind,
                title:
                  lastDecision.kind === "keep"
                    ? `Keeping ${doseLabel(item, item.amount)}`
                    : streakGoal
                      ? `Giving it more time: ${streakGoal.done} of ${STREAK_GOAL} days in a row`
                      : "Giving it more time",
                why: streakGoal
                  ? `You decided this on ${formatShortDate(lastDecision.date)}. Take it ${STREAK_GOAL} days in a row and Supplime checks in again${nextEval > today ? `, on ${formatShortDate(nextEval)} if you don't miss one` : ""}.${streakGoal.done > 0 && streakGoal.done < STREAK_GOAL ? ` You're ${streakGoal.done >= STREAK_GOAL / 2 ? "past halfway" : "on your way"}.` : ""}`
                  : `You decided this on ${formatShortDate(lastDecision.date)}. Supplime checks in again on ${formatShortDate(nextEval)}.`,
              }
            : recommend({
                item,
                day,
                atDose,
                consistency,
                trackedDays,
                working,
                recentSide,
                lastRating: last?.rating ?? null,
                checkIns: effectHistory(item, effects).length,
                noStepUp: p.noStepUp,
                minDays: p.minDaysBeforeIncrease,
                typicalDay: p.typicalDay,
                evaluateDay: p.evaluateDay,
                maxDaily: p.maxDaily,
              });

  // Missed days at this dose push the expected onset back (cumulative supplements).
  const missedDays = Math.max(0, trackedDays - takenDates.size);

  return {
    item,
    profile: p,
    day,
    atDose,
    stepStart,
    takenDays: takenDates.size,
    trackedDays,
    consistency,
    felt,
    last,
    recentSide,
    milestones,
    next,
    phase,
    evaluateDue,
    nextEval,
    doseReviewDate,
    doseReviewOpen,
    recommendation,
    decisions: itemDecisions,
    lastDecision,
    holding,
    changedToday,
    previousStep,
    missedDays,
    awayDays: awayDates.size,
    calendarDay,
    calendarAtDose,
    /** Calendar days that didn't count (missed or away). */
    behind: Math.max(0, calendarDay - day),
    offTrack,
    /** Days in a row right now (today counts once taken). */
    streak: streak.run,
    /** While you're giving it more time: progress toward 14 days in a row. */
    streakGoal,
    /** 0–1 position on the timeline to the verdict day, for progress bars. */
    progress: Math.min(1, day / Math.max(p.evaluateDay, daysBetween(item.startedAt, nextEval) + 1)),
  };
}

function recommend(x: {
  item: StackItem;
  day: number;
  atDose: number;
  consistency: number | null;
  trackedDays: number;
  working: boolean;
  recentSide: boolean;
  lastRating: number | null;
  minDays: number;
  typicalDay: number;
  evaluateDay: number;
  checkIns: number;
  noStepUp?: string;
  maxDaily?: number;
}): Recommendation {
  const { item } = x;
  const dose = doseLabel(item, item.amount);
  if (x.recentSide) {
    const downSwap = capsuleSwap(item, -1);
    if (downSwap)
      return {
        kind: "lower",
        to: downSwap.amount,
        swap: downSwap,
        title: `Lower to ${trimNum(downSwap.amount)} ${item.unit} with a new bottle`,
        why: `You logged side effects recently. ${downSwap.why}`,
      };
    const lower = nextStep(item, -1);
    return lower
      ? {
          kind: "lower",
          to: lower,
          title: `Lower to ${doseLabel(item, lower)}`,
          why: "You logged side effects recently. A smaller dose often keeps the benefit without them.",
        }
      : {
          kind: "stop",
          title: "Stop and reassess",
          why: "You logged side effects and this is already the lowest usual dose.",
        };
  }
  if (x.working) {
    return {
      kind: "keep",
      title: `Keep ${dose}`,
      why: "It's working. There's no reason to raise a dose that already does the job.",
    };
  }
  if (x.consistency !== null && x.trackedDays >= 5 && x.consistency < 0.7) {
    return {
      kind: "more-time",
      title: "Not a fair test yet",
      why: `You took it on ${Math.round(x.consistency * 100)}% of days at this dose. Missed days delay the effect, so try 2 more consistent weeks before judging it.`,
    };
  }
  if (x.atDose < x.minDays) {
    return {
      kind: "more-time",
      title: "Too early to change",
      why: `Day ${x.atDose} at ${dose}. Give it at least ${x.minDays} days before changing the dose.`,
    };
  }
  if (x.day < x.typicalDay) {
    return {
      kind: "more-time",
      title: "Give it more time",
      why: `Most people notice it around day ${x.typicalDay}; you're on day ${x.day}.`,
    };
  }
  if (x.checkIns === 0) {
    return {
      kind: "more-time",
      title: "Check in first",
      why: "You haven't rated how it feels yet. One honest check-in is what a dose decision needs.",
    };
  }
  if (x.noStepUp) {
    return x.day >= x.evaluateDay && (x.lastRating ?? 0) === 0
      ? {
          kind: "stop",
          title: "Consider stopping",
          why: `No effect after ${x.day} days. ${x.noStepUp}`,
        }
      : { kind: "keep", title: `Keep ${dose}, adjust timing`, why: x.noStepUp };
  }
  const up = nextStep(item, 1);
  if (up) {
    return {
      kind: "step-up",
      to: up,
      title: `Step up to ${doseLabel(item, up)}`,
      why: `${x.atDose} days at ${dose} with ${x.lastRating === 1 ? "only a maybe" : "no clear effect"}, and you're below the usual ceiling.`,
    };
  }
  const swap = capsuleSwap(item, 1);
  if (swap) {
    return {
      kind: "step-up",
      to: swap.amount,
      swap,
      title: `Step up to ${trimNum(swap.amount)} ${item.unit} with a new bottle`,
      why: `${x.atDose} days at ${dose} with ${x.lastRating === 1 ? "only a maybe" : "no clear effect"}. ${swap.why}`,
    };
  }
  // No safe step left with your pills, and no other bottle makes one.
  if ((x.lastRating ?? 0) > 0 || x.day < x.evaluateDay) {
    const perDay = Math.max(1, item.slots.length);
    const strength = unitStrength(item).amount;
    const next = (pillsFor(item) + 1) * strength;
    return {
      kind: "keep",
      title: "At the usual top dose",
      why:
        perDay > 1
          ? `You take ${dose} ${perDay}× a day (${trimNum(item.amount * perDay)} ${item.unit} a day). One more pill per dose would be ${trimNum(next * perDay)} ${item.unit} a day, over the usual ${x.maxDaily ?? "limit"} ${item.unit}.`
          : `One more pill would be ${trimNum(next)} ${item.unit} in one dose, more than people usually take. Stay here, or adjust the timing.`,
    };
  }
  if (x.day >= x.evaluateDay) {
    return {
      kind: "stop",
      title: "Consider stopping",
      why: `No clear effect after ${x.day} days, even at ${dose}. It may simply not be for you — that's a useful result too.`,
    };
  }
  return {
    kind: "more-time",
    title: "Stay the course",
    why: `Hold ${dose} until your verdict day.`,
  };
}

/** "300 mg (2 capsules)" when the pill count matters, else "300 mg". */
export function doseLabel(item: StackItem, amount: number) {
  const base = `${trimNum(amount)} ${item.unit}`;
  const strength = unitStrength(item);
  const ratio = amount / strength.amount;
  // Less than one of your pills: that needs a lower-strength bottle.
  if (strength.source !== "none" && Math.abs(ratio - Math.round(ratio)) > 0.01)
    return `${base} (needs a lower-strength bottle)`;
  const pills = pillsFor(item, amount);
  if (!item.product && !unitStrength(item).known)
    return pills > 1 ? `${base} (${pills} pills)` : base;
  const form = item.product?.form === "veg capsule" ? "capsule" : (item.product?.form ?? "capsule");
  return `${base} (${pills} ${form}${pills === 1 ? "" : "s"})`;
}

const trimNum = (n: number) =>
  Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);

export const PHASE_COPY: Record<
  Phase,
  { label: string; tone: "muted" | "accent" | "warn" | "good" }
> = {
  building: { label: "Building up", tone: "muted" },
  window: { label: "In the onset window", tone: "accent" },
  working: { label: "Working", tone: "good" },
  review: { label: "Dose review open", tone: "warn" },
  evaluate: { label: "Verdict due", tone: "warn" },
  offtrack: { label: "Not on track", tone: "warn" },
  holding: { label: "Decided", tone: "good" },
  stopped: { label: "Stopped", tone: "muted" },
};
