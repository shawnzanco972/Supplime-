import { CATALOG } from "./catalog";
import { journeyFor } from "./journey";
import { EXTRA, nextStep, profileFor, type Ask } from "./knowledge";
import { productsFor } from "./products";
import type {
  BodyLog,
  Decision,
  DoseLog,
  EffectLog,
  GoalId,
  Profile,
  SafetyCheck,
  SlotId,
  StackItem,
} from "./types";
import { addDays, daysBetween, uid } from "./utils";

/* ------------------------------------------------------------ check-ins */

/** The question to ask next for a supplement: the area you rated least recently. */
export function nextAsk(item: StackItem, effects: EffectLog[]): Ask {
  const asks = profileFor(item).asks;
  const last = (area: string) =>
    effects
      .filter((e) => e.itemId === item.id && (e.area ?? asks[0]!.area) === area)
      .map((e) => e.date)
      .sort()
      .at(-1) ?? "";
  return [...asks].sort((a, b) => last(a.area).localeCompare(last(b.area)))[0]!;
}

/**
 * Time for a quick side-effect check? Day 3, 10 and 21 on a supplement, 3 days after
 * any dose change, then monthly.
 */
export function safetyDue(item: StackItem, checks: SafetyCheck[], today: string) {
  if (item.paused || item.archived || item.planned) return false;
  const p = profileFor(item);
  if (p.watch.length === 0) return false;
  const mine = checks
    .filter((c) => c.itemId === item.id)
    .sort((a, b) => a.date.localeCompare(b.date));
  const last = mine.at(-1);
  if (last && daysBetween(last.date, today) < 5) return false;
  const day = daysBetween(item.startedAt, today) + 1;
  const stepDate = item.doseHistory.at(-1)?.date ?? item.startedAt;
  const sinceStep = daysBetween(stepDate, today) + 1;
  if (stepDate > item.startedAt && sinceStep >= 3 && (!last || last.date < addDays(stepDate, 2)))
    return true;
  if (!last) return day >= 3;
  for (const mark of [10, 21]) {
    if (day >= mark && last.date < addDays(item.startedAt, mark - 1)) return true;
  }
  return daysBetween(last.date, today) >= 30;
}

/** Symptoms you reported in the last 30 days for a supplement. */
export function recentSymptoms(item: StackItem, checks: SafetyCheck[], today: string) {
  return [
    ...new Set(
      checks
        .filter((c) => c.itemId === item.id && daysBetween(c.date, today) <= 30)
        .flatMap((c) => c.symptoms),
    ),
  ];
}

/* ------------------------------------------------------------ backfill */

export type BackfillPattern = "every" | "most" | "some";

/**
 * "I've been taking it since Sept 1, most days": reconstruct the history so the
 * timeline and consistency are honest. Every day = all days; most = 6 of 7; some = 3 of 7.
 */
export function backfillLogs(
  item: StackItem,
  from: string,
  until: string,
  pattern: BackfillPattern,
): DoseLog[] {
  const out: DoseLog[] = [];
  let i = 0;
  for (let date = from; date < until; date = addDays(date, 1), i++) {
    const skip =
      pattern === "most" ? i % 7 === 3 : pattern === "some" ? ![0, 2, 4].includes(i % 7) : false;
    for (const slot of item.slots) {
      out.push({
        id: uid(),
        itemId: item.id,
        date,
        slot,
        status: skip ? "missed" : "taken",
        at: `${date}T12:00:00.000Z`,
        backfill: true,
      });
    }
  }
  return out;
}

/* ------------------------------------------------------------ before / after */

export type Delta = {
  metric: "sleepHours" | "restingHr" | "hrv";
  before: number;
  after: number;
  change: number;
  better: boolean;
};

/**
 * Compare your wearable data in the 14 days before starting a supplement with the days
 * since its typical onset. Needs at least 4 nights on each side.
 */
export function beforeAfter(item: StackItem, body: BodyLog[], today: string): Delta[] {
  const p = profileFor(item);
  const beforeFrom = addDays(item.startedAt, -14);
  const afterFrom = addDays(item.startedAt, Math.max(1, p.firstSignsDay - 1));
  const out: Delta[] = [];
  for (const metric of ["sleepHours", "restingHr", "hrv"] as const) {
    const pick = (from: string, to: string) =>
      body
        .filter((b) => b.date >= from && b.date < to)
        .map((b) => b[metric])
        .filter((v): v is number => typeof v === "number");
    const before = pick(beforeFrom, item.startedAt);
    const after = pick(afterFrom, addDays(today, 1));
    if (before.length < 4 || after.length < 4) continue;
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    const b = avg(before);
    const a = avg(after);
    const change = a - b;
    out.push({
      metric,
      before: Math.round(b * 10) / 10,
      after: Math.round(a * 10) / 10,
      change: Math.round(change * 10) / 10,
      better: metric === "restingHr" ? change < 0 : change > 0,
    });
  }
  return out;
}

/* ------------------------------------------------------------ recommendations */

const GOAL_MAP: Record<GoalId, string[]> = {
  focus: ["lions-mane", "l-theanine", "bacopa", "omega-3", "alpha-gpc", "creatine"],
  calm: ["l-theanine", "magnesium", "ashwagandha", "reishi", "taurine"],
  sleep: ["magnesium", "glycine", "l-theanine", "ashwagandha", "melatonin", "reishi", "apigenin"],
  energy: ["rhodiola", "vitamin-b12", "vitamin-d", "cordyceps", "creatine", "coq10", "b-complex"],
  mood: ["omega-3", "vitamin-d", "ashwagandha", "lions-mane", "saffron"],
  recovery: ["creatine", "omega-3", "magnesium", "curcumin", "collagen"],
  immunity: ["vitamin-d", "zinc", "vitamin-c", "reishi"],
  longevity: ["omega-3", "vitamin-d", "vitamin-k2", "magnesium", "creatine", "nac"],
};

/** Pairs that work well together (and why). */
const SYNERGY: Record<string, Record<string, string>> = {
  magnesium: {
    melatonin: "Pairs with your melatonin for deeper sleep, not just faster sleep.",
    "l-theanine": "Theanine and magnesium are a classic calm-evening pair.",
    "vitamin-d": "Magnesium is needed to activate vitamin D.",
  },
  glycine: {
    melatonin: "Glycine improves sleep quality where melatonin mostly helps you fall asleep.",
  },
  creatine: {
    "lions-mane":
      "Creatine has some of the best evidence for mental energy — a solid partner for Lion's Mane's focus goal.",
  },
  "omega-3": { "lions-mane": "Omega-3s support the same brain-health goal as Lion's Mane." },
  "vitamin-k2": { "vitamin-d": "K2 is the classic partner for D3." },
  "l-theanine": {
    "lions-mane": "Theanine's same-day calm focus complements Lion's Mane's slow build.",
  },
};

/** Things that shouldn't be added on top of what you take. */
const AVOID_COMBO: Record<string, string[]> = {
  apigenin: ["melatonin"],
  rhodiola: [],
};

export type Idea = {
  catalogId: string;
  name: string;
  score: number;
  reasons: string[];
  evidence: string;
  when: string;
  timing: string;
  watch: string[];
  products: string[];
  caution?: string;
};

export type Reconsider = {
  item: StackItem;
  title: string;
  detail: string;
  action?: "lower" | "stop" | "check" | "switch";
};

export type Advice = {
  /** Start one new thing at a time: the date the next one can start. */
  slotOpensOn: string;
  slotOpen: boolean;
  slotReason: string;
  /** Bottles you own but haven't started — always first in line. */
  planned: StackItem[];
  ideas: Idea[];
  reconsider: Reconsider[];
  increases: { item: StackItem; to: number; why: string }[];
};

const EVIDENCE_SCORE = { strong: 3, moderate: 2, emerging: 1 } as const;

export function advise(state: {
  stack: StackItem[];
  logs: DoseLog[];
  effects: EffectLog[];
  decisions: Decision[];
  checks: SafetyCheck[];
  profile: Pick<Profile, "goals" | "rhythm" | "habits">;
  today: string;
}): Advice {
  const { stack, logs, effects, decisions, checks, profile, today } = state;
  const active = stack.filter((i) => !i.archived && !i.paused && !i.planned);
  const planned = stack.filter((i) => i.planned && !i.archived);
  const have = new Set(
    stack
      .filter((i) => !i.archived)
      .map((i) => i.catalogId)
      .filter(Boolean) as string[],
  );

  // One new thing at a time: wait until the newest supplement is past its typical
  // onset (max 3 weeks), so you can tell what's doing what.
  const newest = [...active].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  let slotOpensOn = today;
  let slotReason = "Nothing new is still settling in.";
  if (newest) {
    const p = profileFor(newest);
    const wait = Math.min(21, p.kind === "acute" ? 7 : p.typicalDay);
    slotOpensOn = addDays(newest.startedAt, wait);
    slotReason = `${newest.name} started ${daysBetween(newest.startedAt, today)} days ago; give it ${wait} days alone so you can tell what's working.`;
  }
  const slotOpen = slotOpensOn <= today;

  // Ideas for your goals.
  const goals = profile.goals.length ? profile.goals : (["focus", "sleep"] as GoalId[]);
  const ideas: Idea[] = [];
  for (const cat of CATALOG) {
    if (have.has(cat.id)) continue;
    const x = EXTRA[cat.id];
    if (!x) continue;
    const goalHits = goals.filter((g) => GOAL_MAP[g]?.includes(cat.id));
    if (goalHits.length === 0) continue;
    if ((AVOID_COMBO[cat.id] ?? []).some((c) => have.has(c))) continue;
    const reasons: string[] = [];
    let score = goalHits.length * 3 + EVIDENCE_SCORE[x.evidence];
    reasons.push(`Fits your goal${goalHits.length > 1 ? "s" : ""}: ${goalHits.join(", ")}.`);
    for (const h of have) {
      const why = SYNERGY[cat.id]?.[h] ?? SYNERGY[h]?.[cat.id];
      if (why) {
        score += 2;
        reasons.push(why);
      }
    }
    if (x.needsLabs) {
      score -= 2;
      reasons.push("Worth it mainly if a blood test shows you're low.");
    }
    if (x.timing.best.some((s) => s === "wake") && profile.rhythm.flexibleWake) score -= 1;
    if (cat.id === "berberine" || cat.id === "iron") score -= 3;
    const p = profileFor({
      catalogId: cat.id,
      slots: [],
      foodTiming: cat.foodTiming,
    } as unknown as StackItem);
    ideas.push({
      catalogId: cat.id,
      name: cat.name,
      score,
      reasons,
      evidence:
        x.evidence === "strong"
          ? "Strong evidence"
          : x.evidence === "moderate"
            ? "Moderate evidence"
            : "Early evidence",
      when: slotOpen ? "You can start it now." : `Best started after ${slotOpensOn}.`,
      timing: `${slotNames(x.timing.best)}${x.timing.food.length === 1 && x.timing.food[0] === "with" ? ", with food" : ""}. Usually felt around day ${p.typicalDay}.`,
      watch: x.watch.slice(0, 3),
      products: productsFor(cat.id).map((pr) => `${pr.brand} ${pr.name}`),
      caution: cat.caution,
    });
  }
  ideas.sort((a, b) => b.score - a.score);

  // Reconsider and dose increases.
  const reconsider: Reconsider[] = [];
  const increases: Advice["increases"] = [];
  for (const item of active) {
    const j = journeyFor({ item, logs, effects, decisions, today });
    const p = j.profile;
    const symptoms = recentSymptoms(item, checks, today);
    if (symptoms.length) {
      const lower = nextStep(item, -1);
      reconsider.push({
        item,
        title: lower ? `Side effects: try a lower dose` : "Side effects: reconsider it",
        detail: `You reported ${symptoms.join(", ").toLowerCase()} recently. ${lower ? `Dropping to ${fmtDose(item, lower)} often keeps the benefit.` : "If it continues, stop and see whether it goes away."}`,
        action: lower ? "lower" : "stop",
      });
      continue;
    }
    const dailyTotal = item.amount * Math.max(1, item.slots.length);
    if (p.maxDaily !== undefined && dailyTotal >= p.maxDaily - 1e-9 && p.noStepUp) {
      reconsider.push({
        item,
        title: `${fmtDose(item, item.amount)} is already the usual ceiling`,
        detail:
          p.noStepUp +
          (item.catalogId === "melatonin"
            ? " A lower-dose product such as Life Extension Melatonin 300 mcg is worth trying if mornings feel groggy."
            : ""),
        action: "switch",
      });
    }
    if (j.recommendation.kind === "step-up" && j.recommendation.to) {
      increases.push({ item, to: j.recommendation.to, why: j.recommendation.why });
    } else if (j.recommendation.title === "Not a fair test yet") {
      reconsider.push({
        item,
        title: "Not a fair test yet",
        detail: j.recommendation.why,
        action: "check",
      });
    } else if (j.recommendation.kind === "stop") {
      reconsider.push({
        item,
        title: j.recommendation.title,
        detail: j.recommendation.why,
        action: "stop",
      });
    }
  }

  return {
    slotOpensOn,
    slotOpen,
    slotReason,
    planned,
    ideas: ideas.slice(0, 4),
    reconsider,
    increases,
  };
}

export function fmtDose(item: StackItem, amount: number) {
  if (item.product) {
    const units = Math.round((amount / item.product.dosePerUnit) * 10) / 10;
    const form = item.product.form === "veg capsule" ? "capsule" : item.product.form;
    return `${units} ${form}${units === 1 ? "" : "s"} (${trim(amount)} ${item.unit})`;
  }
  return `${trim(amount)} ${item.unit}`;
}

const trim = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100));

const SLOT_WORD: Record<SlotId, string> = {
  wake: "on waking",
  breakfast: "with your first meal",
  lunch: "with your second meal",
  afternoon: "in the afternoon",
  dinner: "with your last meal",
  bed: "before bed",
};

export function slotNames(slots: SlotId[]) {
  const words = slots.map((s) => SLOT_WORD[s]);
  if (words.length <= 1) return cap(words[0] ?? "any time");
  return cap(`${words.slice(0, -1).join(", ")} or ${words.at(-1)}`);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
