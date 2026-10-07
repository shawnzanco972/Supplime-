import { ALL_FACTS } from "./knowledge";
import { nextAsk, safetyDue } from "./advisor";
import { journeyFor } from "./journey";
import { activeStack } from "./protocol";
import { dayAdherence, needsCheckIn } from "./stats";
import type {
  BodyLog,
  Decision,
  DoseLog,
  EffectLog,
  Profile,
  SafetyCheck,
  StackItem,
} from "./types";
import { addDays, daysBetween, parseISODate, todayKey } from "./utils";

/**
 * Supplime's motivation layer, built on Yu-kai Chou's Octalysis framework. Every
 * mechanic maps to one of the eight core drives, and it leans on the "white hat"
 * drives (meaning, progress, choice, ownership), with only gentle "black hat"
 * pressure (scarcity, loss):
 *
 * 1. Epic meaning: your "why", and every supplement framed as a personal experiment
 *    whose verdict is real evidence about your body.
 * 2. Accomplishment: XP for real actions, levels, journey milestones, a weekly target.
 * 3. Empowerment: you choose the verdict (keep / step up / lower / stop), adjust your
 *    rhythm, and pick catch-ups. Honest logging of a miss also earns XP.
 * 4. Ownership: field notes you collect, streak shields you earn and keep.
 * 5. Social influence: notes to your future self on each verdict.
 * 6. Scarcity: dose changes unlock only after the minimum days; one insight per day.
 * 7. Unpredictability: the daily insight is a surprise, and some complete days roll
 *    a bonus.
 * 8. Loss avoidance: a streak, softened by shields so one bad day doesn't erase weeks.
 *
 * Everything is derived from your logs, so undoing a dose undoes its XP too.
 */

export const XP = {
  dose: 10,
  lateDose: 6,
  honestMiss: 2,
  checkIn: 15,
  bodyLog: 10,
  fullDay: 20,
  decision: 40,
  weeklyTarget: 75,
  bonus: 25,
  history: 2,
  safety: 10,
  milestone: 15,
} as const;

/** Journey milestones (first signs, typical onset, dose review) you've reached. */
export function milestonesReached(
  state: Pick<State, "stack" | "logs" | "effects" | "decisions">,
  today = todayKey(),
) {
  const out: { itemId: string; key: string; date: string; label: string; name: string }[] = [];
  for (const item of state.stack) {
    if (item.planned) continue;
    const j = journeyFor({
      item,
      logs: state.logs,
      effects: state.effects,
      decisions: state.decisions,
      today,
    });
    for (const m of j.milestones) {
      if (m.key === "start" || m.key === "evaluate" || !m.reached) continue;
      out.push({ itemId: item.id, key: m.key, date: m.date, label: m.label, name: item.name });
    }
  }
  return out;
}

const LEVELS = [
  { xp: 0, name: "Seed" },
  { xp: 100, name: "Sprout" },
  { xp: 250, name: "Seedling" },
  { xp: 500, name: "Rooted" },
  { xp: 900, name: "Growing" },
  { xp: 1500, name: "Leafing" },
  { xp: 2400, name: "Blooming" },
  { xp: 3600, name: "Flourishing" },
  { xp: 5200, name: "Evergreen" },
  { xp: 7500, name: "Old Oak" },
];

export function levelFor(xp: number) {
  let i = 0;
  while (i + 1 < LEVELS.length && xp >= LEVELS[i + 1]!.xp) i++;
  const cur = LEVELS[i]!;
  const next = LEVELS[i + 1];
  return {
    level: i + 1,
    name: cur.name,
    xp,
    floor: cur.xp,
    next: next?.xp ?? null,
    nextName: next?.name ?? null,
    progress: next ? (xp - cur.xp) / (next.xp - cur.xp) : 1,
  };
}

/** Cheap, stable hash so "random" bonuses are the same every time you look. */
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A complete day has a 1-in-5 chance to roll a bonus. */
export function bonusDay(date: string) {
  return hash(`bonus:${date}`) % 5 === 0;
}

type State = {
  stack: StackItem[];
  logs: DoseLog[];
  effects: EffectLog[];
  body: BodyLog[];
  decisions: Decision[];
  checks?: SafetyCheck[];
  profile: Pick<Profile, "weeklyTarget" | "facts" | "joinedAt" | "installedAt">;
};

export type DayOutcome = "success" | "shielded" | "broken" | "open" | "empty";

/**
 * A day counts when you took at least 80% of planned doses, or handled every dose
 * honestly (taken, or a logged skip) while taking at least half. Shields: every 7
 * successful days in a row earn one (max 3); a missed day spends one instead of
 * breaking the streak.
 */
export function streakWithShields(
  state: Pick<State, "stack" | "logs"> & { profile?: Pick<Profile, "joinedAt"> },
  today = todayKey(),
) {
  const starts = state.stack.map((i) => i.startedAt).sort();
  const joined = state.profile?.joinedAt;
  // Backdated start dates are history from before Supplime; don't judge those days.
  const from = starts[0] && joined && joined > starts[0] ? joined : starts[0];
  const days: { date: string; outcome: DayOutcome }[] = [];
  if (!from) return { streak: 0, shields: 0, run: 0, days, todayDone: false };
  let streak = 0;
  let shields = 0;
  let run = 0;
  const start = daysBetween(from, today) > 365 ? addDays(today, -365) : from;
  for (let date = start; date <= today; date = addDays(date, 1)) {
    const a = dayAdherence(state.stack, state.logs, date);
    if (a.scheduled === 0) {
      days.push({ date, outcome: "empty" });
      continue;
    }
    const success = a.rate >= 0.8 || (a.resolved >= a.scheduled && a.taken / a.scheduled >= 0.5);
    if (success) {
      streak += 1;
      run += 1;
      if (run % 7 === 0 && shields < 3) shields += 1;
      days.push({ date, outcome: "success" });
    } else if (date === today) {
      days.push({ date, outcome: "open" });
    } else if (shields > 0) {
      shields -= 1;
      run = 0;
      days.push({ date, outcome: "shielded" });
    } else {
      streak = 0;
      run = 0;
      days.push({ date, outcome: "broken" });
    }
  }
  return { streak, shields, run, days, todayDone: days.at(-1)?.outcome === "success" };
}

/** Monday-to-Sunday progress against your weekly target. */
export function weekProgress(state: Pick<State, "stack" | "logs" | "profile">, today = todayKey()) {
  const d = parseISODate(today);
  const monday = addDays(today, -((d.getDay() + 6) % 7));
  let taken = 0;
  let scheduled = 0;
  let planned = 0;
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    if (state.profile.joinedAt && date < state.profile.joinedAt) continue;
    const a = dayAdherence(state.stack, state.logs, date);
    planned += a.scheduled;
    if (date <= today) {
      taken += a.taken;
      scheduled += a.scheduled;
    }
  }
  const target = state.profile.weeklyTarget || 0.85;
  const needed = Math.max(0, Math.ceil(planned * target) - taken);
  return {
    monday,
    taken,
    scheduled,
    planned,
    target,
    rate: scheduled ? taken / scheduled : 1,
    /** Doses still needed this week to hit the target. */
    needed,
    hit: planned > 0 && taken >= Math.ceil(planned * target),
  };
}

export function totalXp(state: State, today = todayKey()) {
  let xp = 0;
  for (const log of state.logs) {
    if (log.backfill) {
      if (log.status === "taken") xp += XP.history;
      continue;
    }
    if (log.status === "taken") xp += log.late ? XP.lateDose : XP.dose;
    else if ((log.status === "skipped" || log.status === "missed") && log.reason)
      xp += XP.honestMiss;
  }
  xp += state.effects.length * XP.checkIn;
  xp += new Set(state.body.map((b) => b.date)).size * XP.bodyLog;
  xp += state.decisions.length * XP.decision;
  xp += (state.checks?.length ?? 0) * XP.safety;
  xp += milestonesReached(state, today).length * XP.milestone;
  const streak = streakWithShields(state, today);
  const installed = state.profile.installedAt ?? state.profile.joinedAt ?? "";
  for (const d of streak.days) {
    // Days rebuilt from your history earn the small history XP per dose, not full-day XP.
    if (d.outcome !== "success" || d.date < installed) continue;
    xp += XP.fullDay;
    if (bonusDay(d.date)) xp += XP.bonus;
  }
  // Weekly targets hit in past weeks.
  const first = streak.days[0]?.date;
  if (first) {
    for (let week = first; week <= today; week = addDays(week, 7)) {
      const w = weekProgress(state, week);
      const sunday = addDays(w.monday, 6);
      if (sunday < today && w.hit) xp += XP.weeklyTarget;
    }
  }
  return xp;
}

export type Quest = {
  id: string;
  title: string;
  detail: string;
  xp: number;
  done: boolean;
  action?: Action;
};
export type Action =
  | { kind: "check-in"; itemId: string }
  | { kind: "evaluate"; itemId: string }
  | { kind: "body" }
  | { kind: "insight" }
  | { kind: "safety"; itemId: string };

/** Three small, concrete things for today. */
export function todaysQuests(state: State & { profile: Profile }, today = todayKey()): Quest[] {
  const quests: Quest[] = [];
  const a = dayAdherence(state.stack, state.logs, today);
  quests.push({
    id: "doses",
    title: a.scheduled
      ? `Take today's doses (${a.taken}/${a.scheduled})`
      : "Add your first supplement",
    detail: "Every dose +10 XP, a complete day +20.",
    xp: XP.fullDay,
    done: a.scheduled > 0 && a.resolved >= a.scheduled && a.taken / a.scheduled >= 0.5,
  });

  const active = activeStack(state.stack);
  const due = active
    .map((item) =>
      journeyFor({
        item,
        logs: state.logs,
        effects: state.effects,
        decisions: state.decisions,
        today,
      }),
    )
    .find((j) => j.evaluateDue);
  const checkIn = active.find((item) => needsCheckIn(item, state.effects, today));
  const safety = active.find((item) => safetyDue(item, state.checks ?? [], today));
  const checkedToday = state.effects.find((e) => e.date === today);
  if (due) {
    quests.push({
      id: "evaluate",
      title: `Give ${due.item.name} a verdict`,
      detail: `Day ${due.day}: keep, adjust or stop.`,
      xp: XP.decision,
      done: false,
      action: { kind: "evaluate", itemId: due.item.id },
    });
  } else if (safety) {
    quests.push({
      id: "safety",
      title: `Quick safety check: ${safety.name}`,
      detail: "Any side effects lately? Takes 5 seconds.",
      xp: XP.safety,
      done: false,
      action: { kind: "safety", itemId: safety.id },
    });
  } else if (checkIn) {
    quests.push({
      id: "check-in",
      title: `${checkIn.name}: ${nextAsk(checkIn, state.effects).question}`,
      detail: "One tap. It's how Supplime knows when to suggest a dose change.",
      xp: XP.checkIn,
      done: false,
      action: { kind: "check-in", itemId: checkIn.id },
    });
  } else if (checkedToday) {
    quests.push({
      id: "check-in",
      title: "Checked in today",
      detail: "Your timeline just got sharper.",
      xp: XP.checkIn,
      done: true,
    });
  } else {
    const body = state.body.some((b) => b.date === today);
    quests.push({
      id: "body",
      title: "Log how you feel today",
      detail: "Energy, mood, focus, sleep — 20 seconds.",
      xp: XP.bodyLog,
      done: body,
      action: { kind: "body" },
    });
  }

  const insight = todaysInsight(state, today);
  quests.push({
    id: "insight",
    title: insight.unlocked ? "Insight collected" : "Unlock today's insight",
    detail: insight.unlocked
      ? "Find it in your field notes."
      : "Complete today to reveal a new field note.",
    xp: 0,
    done: insight.unlocked,
    action: { kind: "insight" },
  });
  return quests;
}

const GENERAL_TIPS = [
  "Habits stick faster when they ride on an existing cue: keep the bottles next to your kettle or coffee machine.",
  "Most supplement studies measure results at 8–12 weeks. Judging something after one week is like reading one page of a book.",
  "Change one thing at a time. If you start three supplements at once, you can't tell which one is working.",
  "A pill organiser cuts missed doses dramatically — your future self won't have to remember.",
  "Logging a miss honestly is better data than a perfect-looking streak.",
];

/**
 * Today's insight: a fact about one of your supplements you haven't collected yet
 * (or a habit tip). It unlocks once today is complete.
 */
export function todaysInsight(
  state: Pick<State, "stack" | "logs" | "profile">,
  today = todayKey(),
) {
  const mine = new Set(activeStack(state.stack).map((i) => i.catalogId));
  // Stored as "date|factId" so we know which day each note was unlocked.
  const seen = new Set(state.profile.facts.map((f) => f.split("|")[1] ?? f));
  const pool = ALL_FACTS.filter((f) => mine.has(f.itemId) && !seen.has(f.id));
  const fallback = ALL_FACTS.filter((f) => !seen.has(f.id));
  const choose = pool.length ? pool : fallback;
  const pick = choose.length ? choose[hash(today) % choose.length]! : null;
  const unlockedToday = state.profile.facts.find((id) => id.startsWith(`${today}|`));
  const a = dayAdherence(state.stack, state.logs, today);
  const complete = a.scheduled > 0 && a.resolved >= a.scheduled;
  return {
    fact: pick ?? {
      id: `tip:${hash(today) % GENERAL_TIPS.length}`,
      itemId: "",
      text: GENERAL_TIPS[hash(today) % GENERAL_TIPS.length]!,
    },
    unlocked: !!unlockedToday,
    canUnlock: complete && !unlockedToday,
    collected: state.profile.facts.length,
    total: ALL_FACTS.length,
  };
}

export function gameSummary(state: State & { profile: Profile }, today = todayKey()) {
  const xp = totalXp(state, today);
  const streak = streakWithShields(state, today);
  return {
    xp,
    level: levelFor(xp),
    streak: streak.streak,
    shields: streak.shields,
    todayDone: streak.todayDone,
    lastDays: streak.days.slice(-14),
    week: weekProgress(state, today),
    quests: todaysQuests(state, today),
    insight: todaysInsight(state, today),
  };
}
