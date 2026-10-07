import { CATALOG_BY_ID } from "./catalog";
import type { CatalogItem, HabitRule, MissedMode, StackItem } from "./types";

/**
 * What Supplime knows about each supplement beyond the basic guide entry:
 *
 * - the effect timeline in days (when you might first notice it, when most people do,
 *   and when it is fair to decide whether it works for you),
 * - the minimum days at one dose before changing it,
 * - a dose ladder for stepping up or down,
 * - habit rules (food, coffee, alcohol, time of day, spacing from other supplements),
 * - what to do when a dose is missed,
 * - short facts that unlock as insight cards.
 *
 * These are typical ranges from common use and studies, not medical advice.
 */
type Knowledge = {
  firstSignsDay?: number;
  typicalDay?: number;
  evaluateDay: number;
  /** Defaults to the guide's increaseAfterDays. */
  minDaysBeforeIncrease?: number;
  steps?: number[];
  /** When more is not the answer: shown instead of a step-up suggestion. */
  noStepUp?: string;
  rules: HabitRule[];
  missed: MissedMode;
  facts: string[];
};

const FOOD: HabitRule = { kind: "needs-food", text: "Take with food" };
const FAT: HabitRule = { kind: "needs-fat", text: "Needs a meal with some fat" };
const EMPTY: HabitRule = { kind: "empty-stomach", text: "Empty stomach, 20–30 min before food" };
const MORNING: HabitRule = { kind: "stimulating", text: "Morning or early afternoon only" };
const EVENING: HabitRule = { kind: "drowsy", text: "Relaxing — best in the evening" };

export const KNOWLEDGE: Record<string, Knowledge> = {
  "lions-mane": {
    firstSignsDay: 7,
    typicalDay: 21,
    evaluateDay: 56,
    steps: [500, 1000, 1500, 2000],
    rules: [{ kind: "needs-food", text: "With food — easier on the stomach" }],
    missed: "catch-up",
    facts: [
      "Lion's Mane studies that found memory benefits ran for 8–16 weeks, which is why Supplime waits until day 56 to ask for a verdict.",
      "Look for a fruiting-body extract with a stated beta-glucan content. Mycelium on grain is mostly starch.",
      "The compounds people talk about, hericenones and erinacines, come from the fruiting body and the mycelium respectively.",
    ],
  },
  "l-theanine": {
    firstSignsDay: 1,
    typicalDay: 3,
    evaluateDay: 14,
    minDaysBeforeIncrease: 5,
    steps: [100, 200, 300, 400],
    rules: [{ kind: "pairs-caffeine", text: "Pairs well with coffee — smooths the jitters" }],
    missed: "optional",
    facts: [
      "A cup of green tea has about 8–30 mg of L-theanine. A 200 mg capsule is like 10 cups.",
      "The classic ratio is about 2:1 theanine to caffeine: 200 mg with a 100 mg coffee.",
      "Theanine raises alpha brain waves, the relaxed-but-alert state, within about 40 minutes.",
    ],
  },
  melatonin: {
    firstSignsDay: 1,
    typicalDay: 3,
    evaluateDay: 14,
    steps: [0.3, 0.5, 1, 3],
    noStepUp:
      "With melatonin, more milligrams rarely help. Try taking it at the same time nightly, 30–60 min before bed, with dim lights and no screens, before changing the dose.",
    rules: [
      {
        kind: "avoid-alcohol",
        hours: 4,
        text: "No alcohol within 4 h — it fragments sleep and stacks drowsiness",
      },
      { kind: "drowsy", text: "Only at bedtime — it makes you drowsy" },
    ],
    missed: "bedtime-only",
    facts: [
      "0.3 mg is close to what your body makes at night. Many people sleep just as well on 0.5 mg as on 5 mg, with less morning grogginess.",
      "Melatonin is a timing signal, not a knockout pill. Taking it at the same time each night matters more than the dose.",
      "Bright screens in the hour before bed can suppress your own melatonin by up to half.",
    ],
  },
  magnesium: {
    evaluateDay: 28,
    steps: [100, 200, 300, 400],
    rules: [
      EVENING,
      {
        kind: "separate",
        hours: 2,
        with: ["zinc", "iron"],
        text: "Keep 2 h apart from zinc and iron",
      },
    ],
    missed: "catch-up",
    facts: [
      "“200 mg magnesium glycinate” can mean 200 mg of the compound or of elemental magnesium. Check the label for the elemental amount.",
      "Glycinate is gentle on the gut; citrate and oxide are more likely to loosen stools.",
    ],
  },
  "vitamin-d": {
    firstSignsDay: 28,
    typicalDay: 42,
    evaluateDay: 84,
    minDaysBeforeIncrease: 56,
    steps: [1000, 2000, 4000],
    rules: [FAT],
    missed: "catch-up",
    facts: [
      "Vitamin D3 taken with the day's largest meal raised blood levels about 50% more than on an empty stomach in one study.",
      "Blood 25-OH vitamin D takes 8–12 weeks to settle at a new level. Test after that, not before.",
    ],
  },
  "vitamin-k2": {
    firstSignsDay: 28,
    typicalDay: 60,
    evaluateDay: 90,
    steps: [90, 100, 200],
    rules: [FAT],
    missed: "catch-up",
    facts: ["MK-7 stays in the blood for days, so one missed dose barely matters."],
  },
  "omega-3": {
    firstSignsDay: 21,
    typicalDay: 42,
    evaluateDay: 84,
    minDaysBeforeIncrease: 28,
    rules: [FAT],
    missed: "catch-up",
    facts: [
      "It takes about 3–4 months for omega-3 to fully build up in red blood cells.",
      "Fishy burps usually mean taking it without food. Take it mid-meal or keep the bottle in the fridge.",
    ],
  },
  ashwagandha: {
    firstSignsDay: 14,
    typicalDay: 28,
    evaluateDay: 56,
    steps: [300, 600],
    rules: [
      FOOD,
      EVENING,
      {
        kind: "avoid-alcohol",
        hours: 3,
        text: "Adds to alcohol's sedation — keep a few hours apart",
      },
    ],
    missed: "catch-up",
    facts: [
      "Most stress studies used 300–600 mg of root extract for 8 weeks.",
      "Many people cycle ashwagandha, for example 8 weeks on and 2–4 weeks off.",
    ],
  },
  rhodiola: {
    firstSignsDay: 1,
    typicalDay: 10,
    evaluateDay: 21,
    steps: [200, 300, 400],
    rules: [EMPTY, MORNING],
    missed: "morning-only",
    facts: [
      "Rhodiola has been used for centuries in Scandinavia and Siberia to cope with long, dark winters.",
    ],
  },
  bacopa: {
    firstSignsDay: 28,
    typicalDay: 56,
    evaluateDay: 84,
    minDaysBeforeIncrease: 28,
    rules: [FAT, { kind: "drowsy", text: "Can make you a little drowsy at first" }],
    missed: "catch-up",
    facts: [
      "Bacopa is one of the slowest nootropics: memory studies read results at 12 weeks.",
      "Taking it with fat and food reduces the stomach upset it is known for.",
    ],
  },
  creatine: {
    firstSignsDay: 14,
    typicalDay: 21,
    evaluateDay: 42,
    steps: [3, 5],
    rules: [],
    missed: "catch-up",
    facts: [
      "At 3–5 g a day, muscles saturate in about 3–4 weeks. Timing in the day barely matters; consistency does.",
      "Creatine is one of the most studied supplements there is, with research going back to the 1990s.",
    ],
  },
  zinc: {
    evaluateDay: 56,
    rules: [
      { kind: "needs-food", text: "With food — on an empty stomach it can cause nausea" },
      {
        kind: "separate",
        hours: 2,
        with: ["magnesium", "iron"],
        text: "Keep 2 h apart from magnesium and iron",
      },
    ],
    missed: "catch-up",
    facts: [
      "Long-term zinc above about 40 mg a day can lower copper. Many zinc products include copper for that reason.",
    ],
  },
  "vitamin-c": {
    evaluateDay: 28,
    rules: [],
    missed: "catch-up",
    facts: [
      "Your body absorbs vitamin C best in doses up to about 200 mg. Splitting larger amounts helps.",
    ],
  },
  "vitamin-b12": {
    evaluateDay: 56,
    rules: [MORNING],
    missed: "morning-only",
    facts: [
      "B12 deficiency is common on plant-based diets and with long-term metformin or acid-reducer use.",
    ],
  },
  glycine: {
    firstSignsDay: 1,
    typicalDay: 3,
    evaluateDay: 14,
    steps: [1, 3],
    rules: [EVENING],
    missed: "bedtime-only",
    facts: [
      "3 g of glycine before bed lowered core body temperature slightly in studies, one of the signals for sleep.",
    ],
  },
  curcumin: {
    evaluateDay: 56,
    rules: [FAT],
    missed: "catch-up",
    facts: [
      "Plain curcumin is poorly absorbed. Black pepper (piperine) or a phytosome form makes a big difference.",
    ],
  },
  coq10: {
    evaluateDay: 84,
    rules: [FAT, { kind: "stimulating", text: "Some people sleep worse if they take it late" }],
    missed: "morning-only",
    facts: ["Statin medications lower your body's own CoQ10 production."],
  },
  probiotic: {
    evaluateDay: 28,
    rules: [],
    missed: "catch-up",
    facts: [
      "Probiotic effects are strain-specific. A strain studied for one thing will not necessarily help another.",
    ],
  },
  iron: {
    evaluateDay: 90,
    rules: [
      EMPTY,
      {
        kind: "avoid-caffeine",
        hours: 1,
        text: "No coffee or tea within 1 h — they block iron absorption",
      },
      {
        kind: "separate",
        hours: 2,
        with: ["zinc", "magnesium"],
        text: "Keep 2 h apart from zinc and magnesium",
      },
    ],
    missed: "catch-up",
    facts: [
      "Taking iron every other day can absorb as well as daily, with fewer stomach complaints.",
    ],
  },
  collagen: {
    firstSignsDay: 28,
    typicalDay: 56,
    evaluateDay: 84,
    rules: [],
    missed: "catch-up",
    facts: ["Skin and joint studies on collagen peptides typically ran 8–12 weeks."],
  },
  electrolytes: {
    firstSignsDay: 1,
    typicalDay: 1,
    evaluateDay: 7,
    rules: [],
    missed: "optional",
    facts: [
      "Sodium is the electrolyte most people actually lose in sweat, far more than potassium or magnesium.",
    ],
  },
  reishi: {
    evaluateDay: 42,
    rules: [EVENING],
    missed: "catch-up",
    facts: ["Reishi is famously bitter, which is why it is mostly sold as capsules or extracts."],
  },
  cordyceps: {
    evaluateDay: 28,
    rules: [MORNING],
    missed: "morning-only",
    facts: [
      "Most cordyceps supplements are Cordyceps militaris grown on substrate, not wild-harvested sinensis.",
    ],
  },
  "alpha-gpc": {
    firstSignsDay: 1,
    typicalDay: 3,
    evaluateDay: 14,
    rules: [MORNING, { kind: "pairs-caffeine", text: "Often paired with morning coffee" }],
    missed: "morning-only",
    facts: [
      "Alpha-GPC delivers choline, the building block of acetylcholine, the 'learning' neurotransmitter.",
    ],
  },
  berberine: {
    evaluateDay: 56,
    rules: [{ kind: "needs-food", text: "With a meal — it works on the food you eat" }],
    missed: "catch-up",
    facts: ["Berberine has a short half-life, which is why it is usually split across meals."],
  },
  taurine: {
    evaluateDay: 28,
    rules: [],
    missed: "catch-up",
    facts: ["Energy drinks add taurine, but it is calming rather than stimulating on its own."],
  },
  saffron: {
    evaluateDay: 56,
    rules: [FOOD],
    missed: "catch-up",
    facts: ["It takes about 150,000 crocus flowers to make a kilogram of saffron spice."],
  },
  apigenin: {
    firstSignsDay: 1,
    typicalDay: 5,
    evaluateDay: 14,
    rules: [
      EVENING,
      {
        kind: "avoid-alcohol",
        hours: 3,
        text: "Adds to alcohol's sedation — keep a few hours apart",
      },
    ],
    missed: "bedtime-only",
    facts: [
      "A cup of chamomile tea contains a few milligrams of apigenin. Supplements are around 50 mg.",
    ],
  },
  nac: {
    evaluateDay: 56,
    rules: [],
    missed: "catch-up",
    facts: ["NAC has been used in hospitals for decades as the antidote for paracetamol overdose."],
  },
  "b-complex": {
    evaluateDay: 28,
    rules: [FOOD, MORNING],
    missed: "morning-only",
    facts: ["The bright yellow urine after a B-complex is riboflavin (B2). It is harmless."],
  },
};

/** Defaults for things the guide doesn't know, by category. */
const CATEGORY_DEFAULTS: Record<CatalogItem["category"], { typical: number; evaluate: number }> = {
  nootropic: { typical: 21, evaluate: 56 },
  adaptogen: { typical: 21, evaluate: 56 },
  vitamin: { typical: 42, evaluate: 84 },
  mineral: { typical: 21, evaluate: 56 },
  amino: { typical: 7, evaluate: 28 },
  omega: { typical: 42, evaluate: 84 },
  gut: { typical: 14, evaluate: 28 },
  sleep: { typical: 3, evaluate: 14 },
  other: { typical: 21, evaluate: 42 },
};

export type Profile = {
  kind: "acute" | "cumulative";
  /** Minutes until you feel a single dose, for same-day supplements. */
  minutes?: { min: number; max: number };
  firstSignsDay: number;
  typicalDay: number;
  /** End of the usual onset range. */
  windowEndDay: number;
  minDaysBeforeIncrease: number;
  evaluateDay: number;
  steps: number[];
  noStepUp?: string;
  rules: HabitRule[];
  missed: MissedMode;
  facts: string[];
  note: string;
  increaseGuidance: string;
  ceiling: string;
  catalog?: CatalogItem;
};

/** Everything Supplime knows about one stack item, with your own overrides on top. */
export function profileFor(item: StackItem): Profile {
  const cat = item.catalogId ? CATALOG_BY_ID[item.catalogId] : undefined;
  const k = item.catalogId ? KNOWLEDGE[item.catalogId] : undefined;
  const o = item.overrides ?? {};
  const base = cat ? CATEGORY_DEFAULTS[cat.category] : CATEGORY_DEFAULTS.other;

  const firstSigns = o.firstSignsDay ?? k?.firstSignsDay ?? cat?.onset.days.min ?? 7;
  const windowEnd = Math.max(firstSigns, cat?.onset.days.max ?? base.typical + 7);
  const typical =
    o.typicalDay ??
    k?.typicalDay ??
    (cat ? Math.round((cat.onset.days.min + cat.onset.days.max) / 2) : base.typical);
  const evaluate = o.evaluateDay ?? k?.evaluateDay ?? base.evaluate;
  const rules = o.rules ?? k?.rules ?? defaultRules(item);

  return {
    kind: cat?.onset.kind ?? "cumulative",
    minutes: cat?.onset.minutes,
    firstSignsDay: firstSigns,
    typicalDay: Math.max(firstSigns, typical),
    windowEndDay: Math.max(windowEnd, typical),
    minDaysBeforeIncrease:
      o.minDaysBeforeIncrease ?? k?.minDaysBeforeIncrease ?? cat?.increaseAfterDays ?? 14,
    evaluateDay: Math.max(evaluate, typical),
    steps: k?.steps ?? [],
    noStepUp: k?.noStepUp,
    rules,
    missed: o.missed ?? k?.missed ?? "catch-up",
    facts: k?.facts ?? [],
    note:
      cat?.onset.note ??
      "Your own numbers. Rate how you feel every few days, and the journey will show when it actually kicked in.",
    increaseGuidance: cat?.increaseGuidance ?? "Give one dose a fair run before changing it.",
    ceiling: cat?.typicalCeiling ?? "Check the label",
    catalog: cat,
  };
}

function defaultRules(item: StackItem): HabitRule[] {
  if (item.foodTiming === "with") return [FOOD];
  if (item.foodTiming === "empty") return [EMPTY];
  return [];
}

/** Next rung on the dose ladder above (or below) the current amount. */
export function nextStep(item: StackItem, direction: 1 | -1): number | null {
  const steps = profileFor(item).steps;
  if (steps.length === 0) return null;
  if (direction === 1) return steps.find((s) => s > item.amount + 1e-9) ?? null;
  return [...steps].reverse().find((s) => s < item.amount - 1e-9) ?? null;
}

export const ALL_FACTS: { id: string; itemId: string; text: string }[] = Object.entries(
  KNOWLEDGE,
).flatMap(([itemId, k]) => k.facts.map((text, i) => ({ id: `${itemId}:${i}`, itemId, text })));
