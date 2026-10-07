import { profileFor } from "./knowledge";
import { activeStack, scheduledDoses } from "./protocol";
import type { BadgeId, BodyLog, DoseLog, DoseStep, EffectLog, StackItem } from "./types";
import { addDays, daysBetween, todayKey } from "./utils";

export function daysOn(item: StackItem, today = todayKey()) {
  return Math.max(0, daysBetween(item.startedAt, today) + 1);
}

/** The dose step you are on now. Falls back to the item itself for older data. */
export function currentStep(item: StackItem): DoseStep {
  const last = item.doseHistory?.[item.doseHistory.length - 1];
  return last ?? { date: item.startedAt, amount: item.amount, unit: item.unit };
}

/** Calendar days since you moved to the current dose (day 1 = the day you changed). */
export function daysAtDose(item: StackItem, today = todayKey()) {
  const step = currentStep(item);
  const from = step.date > item.startedAt ? step.date : item.startedAt;
  return Math.max(0, daysBetween(from, today) + 1);
}

/** Distinct days you actually logged a taken dose, optionally from a start date. */
export function takenDays(item: StackItem, logs: DoseLog[], from?: string) {
  const days = new Set<string>();
  for (const log of logs) {
    if (log.itemId !== item.id || log.status !== "taken") continue;
    if (from && log.date < from) continue;
    days.add(log.date);
  }
  return days.size;
}

/**
 * How consistent you have been since you started logging this item in the app.
 * Days before the first log are ignored, so backdating "Started on" is not punished.
 */
export function loggingConsistency(item: StackItem, logs: DoseLog[], today = todayKey()) {
  const mine = logs
    .filter((l) => l.itemId === item.id && l.status === "taken")
    .map((l) => l.date)
    .sort();
  if (mine.length === 0) return null;
  const from = mine[0] > item.startedAt ? mine[0] : item.startedAt;
  const span = Math.max(1, daysBetween(from, today) + 1);
  const taken = new Set(mine.filter((d) => d >= from)).size;
  return { span, taken, rate: taken / span };
}

export function effectHistory(item: StackItem, effects: EffectLog[]) {
  return effects.filter((e) => e.itemId === item.id).sort((a, b) => a.date.localeCompare(b.date));
}

/** First check-in where you rated the effect as noticeable or better. */
export function firstFelt(item: StackItem, effects: EffectLog[]) {
  const hit = effectHistory(item, effects).find((e) => e.rating >= 2);
  if (!hit) return null;
  return { log: hit, day: Math.max(1, daysBetween(item.startedAt, hit.date) + 1) };
}

export function latestEffect(item: StackItem, effects: EffectLog[]) {
  const list = effectHistory(item, effects);
  return list[list.length - 1] ?? null;
}

export const EFFECT_COPY = ["Nothing yet", "Maybe", "Noticeable", "Clear effect"] as const;

/**
 * Should Supplime ask "do you feel it?" today? Yes once you are near the onset window
 * and you have not checked in for this item in the last few days.
 */
export function needsCheckIn(item: StackItem, effects: EffectLog[], today = todayKey()) {
  if (item.paused || item.archived) return false;
  const w = effectWindow(item, today);
  const near = w.kind === "acute" ? w.elapsed >= 2 : w.elapsed >= Math.max(3, w.onsetMin - 2);
  if (!near) return false;
  const last = latestEffect(item, effects);
  if (!last) return true;
  if (last.rating >= 3) return daysBetween(last.date, today) >= 14;
  return daysBetween(last.date, today) >= (w.kind === "acute" ? 3 : 5);
}

export function dosesPerDay(item: StackItem) {
  return Math.max(1, item.slots.length);
}

export function daysOfStock(item: StackItem) {
  const perDay = item.servingsPerDose * dosesPerDay(item);
  if (perDay <= 0) return 0;
  return Math.floor(item.servingsRemaining / perDay);
}

export function isLowStock(item: StackItem) {
  return daysOfStock(item) <= item.reorderAtDays;
}

export function effectWindow(item: StackItem, today = todayKey()) {
  const p = profileFor(item);
  const elapsed = daysOn(item, today);
  const atDose = daysAtDose(item, today);
  let label: string;
  if (p.kind === "acute" && p.minutes && elapsed <= p.windowEndDay) {
    label = `Felt in ${p.minutes.min}–${p.minutes.max} min; judge it over ${p.windowEndDay} days`;
  } else if (elapsed < p.firstSignsDay) {
    const left = p.firstSignsDay - elapsed;
    label = `${left} day${left === 1 ? "" : "s"} until first signs are possible`;
  } else if (elapsed < p.typicalDay) {
    const left = p.typicalDay - elapsed;
    label = `Early days: most people notice it in ${left} more day${left === 1 ? "" : "s"}`;
  } else if (elapsed <= p.windowEndDay) {
    label = `Inside the usual window (days ${p.firstSignsDay}–${p.windowEndDay})`;
  } else {
    label = "Past the usual onset window";
  }
  const stepStart =
    currentStep(item).date > item.startedAt ? currentStep(item).date : item.startedAt;
  return {
    elapsed,
    atDose,
    onsetMin: p.firstSignsDay,
    onsetMax: p.windowEndDay,
    typicalDay: p.typicalDay,
    evaluateDay: p.evaluateDay,
    minDaysBeforeIncrease: p.minDaysBeforeIncrease,
    kind: p.kind,
    label,
    detail: p.note,
    progress: Math.min(1, elapsed / p.evaluateDay),
    readyToIncrease: atDose >= p.minDaysBeforeIncrease,
    reviewOn: addDays(stepStart, p.minDaysBeforeIncrease - 1),
    increaseGuidance: p.increaseGuidance,
    catalog: p.catalog,
  };
}

/** Doses that were planned on a given date (respecting start and stop dates). */
export function dosesOn(stack: StackItem[], date: string) {
  return scheduledDoses(
    stack.map((item) =>
      item.archived && item.archived.date > date ? { ...item, archived: undefined } : item,
    ),
  ).filter((d) => d.item.startedAt <= date);
}

const RESOLVED = new Set(["taken", "skipped", "missed"]);

export function logsForDate(logs: DoseLog[], date: string) {
  return logs.filter((log) => log.date === date);
}

/** Doses still open for a date (not taken, skipped or missed; deferred ones stay open). */
export function remainingKeys(stack: StackItem[], logs: DoseLog[], date: string) {
  const taken = new Set(
    logsForDate(logs, date)
      .filter((log) => RESOLVED.has(log.status))
      .map((log) => `${log.itemId}:${log.slot}`),
  );
  const left = new Set<string>();
  for (const dose of dosesOn(stack, date)) {
    const key = `${dose.item.id}:${dose.slot}`;
    if (!taken.has(key)) left.add(key);
  }
  return left;
}

export function dayAdherence(stack: StackItem[], logs: DoseLog[], date: string) {
  // Only count items that had already started on that date, so adding something new
  // does not retroactively break past streaks.
  const scheduled = dosesOn(stack, date);
  if (scheduled.length === 0)
    return { taken: 0, scheduled: 0, skipped: 0, resolved: 0, late: 0, rate: 1 };
  const planned = new Set(scheduled.map((d) => `${d.item.id}:${d.slot}`));
  const day = logsForDate(logs, date).filter((l) => planned.has(`${l.itemId}:${l.slot}`));
  const taken = day.filter((l) => l.status === "taken").length;
  const skipped = day.filter((l) => l.status === "skipped" || l.status === "missed").length;
  return {
    taken,
    skipped,
    resolved: taken + skipped,
    late: day.filter((l) => l.status === "taken" && l.late).length,
    scheduled: scheduled.length,
    rate: Math.min(1, taken / scheduled.length),
  };
}

export function rangeAdherence(stack: StackItem[], logs: DoseLog[], from: string, to: string) {
  let taken = 0;
  let scheduled = 0;
  for (let key = from; key <= to; key = addDays(key, 1)) {
    const day = dayAdherence(stack, logs, key);
    taken += day.taken;
    scheduled += day.scheduled;
  }
  return { taken, scheduled, rate: scheduled === 0 ? 1 : taken / scheduled };
}

export function streakDays(stack: StackItem[], logs: DoseLog[], today = todayKey()) {
  if (activeStack(stack).length === 0) return 0;
  let streak = 0;
  let cursor = today;
  const todayStats = dayAdherence(stack, logs, today);
  if (todayStats.rate < 0.8 && todayStats.taken === 0) {
    cursor = addDays(today, -1);
  }
  for (let i = 0; i < 400; i++) {
    const stats = dayAdherence(stack, logs, cursor);
    if (stats.scheduled === 0) break;
    if (stats.rate >= 0.8) {
      streak += 1;
      cursor = addDays(cursor, -1);
      continue;
    }
    break;
  }
  return streak;
}

export function ritualScore(
  stack: StackItem[],
  logs: DoseLog[],
  body: BodyLog[],
  today = todayKey(),
) {
  const day = dayAdherence(stack, logs, today);
  const weekFrom = addDays(today, -6);
  const week = rangeAdherence(stack, logs, weekFrom, today);
  const streak = streakDays(stack, logs, today);
  const low = activeStack(stack).filter(isLowStock).length;
  const loggedBody = body.some((b) => b.date === today) ? 1 : 0;
  const take = Math.round(day.rate * 55);
  const consistency = Math.round(week.rate * 25);
  const streakPts = Math.min(15, streak * 2);
  const stockPts = low === 0 ? 5 : 0;
  return {
    score: Math.min(100, take + consistency + streakPts + stockPts + loggedBody * 0),
    day,
    week,
    streak,
    low,
  };
}

export function earnedBadges(input: {
  stack: StackItem[];
  logs: DoseLog[];
  body: BodyLog[];
  effects?: EffectLog[];
  already: BadgeId[];
  refilled?: boolean;
}): BadgeId[] {
  const today = todayKey();
  const next = new Set(input.already);
  const takenAny = input.logs.some((l) => l.status === "taken");
  if (takenAny) next.add("first-dose");
  const streak = streakDays(input.stack, input.logs, today);
  if (streak >= 7) next.add("week-streak");
  if (streak >= 21) next.add("habit");
  const weekFrom = addDays(today, -6);
  const week = rangeAdherence(input.stack, input.logs, weekFrom, today);
  if (week.scheduled >= 7 && week.rate >= 0.999) next.add("perfect-week");
  if (input.refilled) next.add("stock-steward");
  const bodyDays = new Set(input.body.map((b) => b.date)).size;
  if (bodyDays >= 7) next.add("signal-keeper");
  if (input.stack.some((item) => effectWindow(item, today).progress >= 1)) next.add("onset");
  if (input.effects?.some((e) => e.rating >= 2)) next.add("felt-it");
  return [...next];
}

export const BADGE_COPY: Record<BadgeId, { name: string; detail: string }> = {
  "first-dose": { name: "Opened", detail: "First dose logged." },
  "week-streak": { name: "Seven days", detail: "A week of showing up." },
  habit: { name: "Settled in", detail: "Twenty-one days in cadence." },
  "perfect-week": { name: "Clean week", detail: "Every planned dose, seven days." },
  "stock-steward": { name: "Ahead of empty", detail: "Refilled before you ran out." },
  "signal-keeper": { name: "Signal keeper", detail: "A week of body metrics." },
  onset: { name: "Window reached", detail: "Hit a typical onset window." },
  "felt-it": { name: "Felt it", detail: "Logged a noticeable effect." },
};

export function bodyAverages(body: BodyLog[], days = 7, today = todayKey()) {
  const from = addDays(today, -(days - 1));
  const slice = body.filter((b) => b.date >= from && b.date <= today);
  const avg = (pick: (b: BodyLog) => number | undefined) => {
    const vals = slice.map(pick).filter((n): n is number => typeof n === "number");
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  };
  return {
    count: slice.length,
    sleepHours: avg((b) => b.sleepHours),
    sleepScore: avg((b) => b.sleepScore),
    restingHr: avg((b) => b.restingHr),
    hrv: avg((b) => b.hrv),
    energy: avg((b) => b.energy),
    mood: avg((b) => b.mood),
    focus: avg((b) => b.focus),
  };
}

export function suggestions(stack: StackItem[], goals: string[]) {
  const have = new Set(stack.map((s) => s.catalogId).filter(Boolean));
  const ideas: { name: string; why: string }[] = [];
  if (goals.includes("sleep") && !have.has("magnesium")) {
    ideas.push({
      name: "Magnesium glycinate",
      why: "A usual evening partner for sleep and muscle ease.",
    });
  }
  if (goals.includes("focus") && have.has("lions-mane") && !have.has("l-theanine")) {
    ideas.push({
      name: "L-Theanine",
      why: "Pairs with Lion's Mane for calm focus the same morning.",
    });
  }
  if (have.has("vitamin-d") && !have.has("vitamin-k2")) {
    ideas.push({ name: "Vitamin K2 (MK-7)", why: "Classic pairing with D3 and breakfast fat." });
  }
  if (have.has("vitamin-d") && !have.has("magnesium")) {
    ideas.push({
      name: "Magnesium glycinate",
      why: "Magnesium is part of the path that activates vitamin D.",
    });
  }
  if (goals.includes("focus") && have.has("l-theanine") && !have.has("lions-mane")) {
    ideas.push({
      name: "Lion's Mane",
      why: "Longer-arc cognition to sit beside theanine's same-day calm.",
    });
  }
  if (goals.includes("mood") && !have.has("omega-3")) {
    ideas.push({
      name: "Omega-3 (EPA/DHA)",
      why: "A foundational fat for mood, taken with a real meal.",
    });
  }
  if (goals.includes("energy") && !have.has("rhodiola") && !have.has("vitamin-d")) {
    ideas.push({
      name: "Vitamin D3",
      why: "Worth running if you rarely see sun — confirm with a lab when you can.",
    });
  }
  return ideas.slice(0, 4);
}
