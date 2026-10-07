import { CATALOG_BY_ID } from "./catalog";
import { productsFor } from "./products";
import type { CatalogItem, FoodTiming, HabitRule, MissedMode, SlotId, StackItem } from "./types";

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

/* -------------------------------------------------------------- knowledge v2 */

type Slot = SlotId;
type Timing = { best: Slot[]; ok: Slot[]; avoid: Slot[]; food: FoodTiming[] };
const T = (best: Slot[], ok: Slot[], avoid: Slot[], food: FoodTiming[]): Timing => ({
  best,
  ok,
  avoid,
  food,
});
const ALL: Slot[] = ["wake", "breakfast", "lunch", "afternoon", "dinner", "bed"];
const MEALS: Slot[] = ["breakfast", "lunch", "dinner"];

export type Ask = { area: string; question: string };
export type Evidence = "strong" | "moderate" | "emerging";

type Extra = {
  timing: Timing;
  asks: Ask[];
  /** Side effects worth checking for now and then. */
  watch: string[];
  evidence: Evidence;
  /** Usual daily ceiling, in the guide's dose unit. */
  maxDaily?: number;
  /** When evidence depends on being low first (labs). */
  needsLabs?: boolean;
};

const ask = (area: string, question: string): Ask => ({ area, question });

export const EXTRA: Record<string, Extra> = {
  "lions-mane": {
    timing: T(["breakfast"], ["wake", "lunch", "afternoon"], ["bed"], ["with", "empty", "any"]),
    asks: [
      ask("focus", "Is your focus sharper than before you started?"),
      ask("memory", "Are words and names coming more easily?"),
    ],
    watch: ["Itchy skin or rash", "Stomach upset", "Restlessness"],
    evidence: "emerging",
    maxDaily: 3000,
  },
  "l-theanine": {
    timing: T(
      ["breakfast", "afternoon"],
      ["wake", "lunch", "dinner", "bed"],
      [],
      ["empty", "with", "any"],
    ),
    asks: [ask("calm", "Calmer in tense moments, without feeling sleepy?")],
    watch: ["Daytime drowsiness", "Headache", "Feeling too flat"],
    evidence: "moderate",
    maxDaily: 400,
  },
  melatonin: {
    timing: T(["bed"], [], ["wake", "breakfast", "lunch", "afternoon"], ["any", "empty", "with"]),
    asks: [
      ask("sleep-onset", "Falling asleep faster than before?"),
      ask("sleep-quality", "Waking up rested, not groggy?"),
    ],
    watch: ["Morning grogginess", "Vivid dreams or nightmares", "Headache", "Daytime sleepiness"],
    evidence: "strong",
    maxDaily: 3,
  },
  magnesium: {
    timing: T(["bed", "dinner"], ["lunch", "afternoon"], [], ["with", "empty", "any"]),
    asks: [
      ask("sleep-quality", "Sleeping more deeply?"),
      ask("muscles", "Fewer cramps or tight muscles?"),
    ],
    watch: ["Loose stools", "Stomach upset"],
    evidence: "moderate",
    maxDaily: 400,
  },
  "vitamin-d": {
    timing: T(MEALS, [], ["bed"], ["with"]),
    asks: [ask("energy", "Energy and mood steadier? (Labs are the real test.)")],
    watch: ["Nausea or constipation", "Unusual thirst"],
    evidence: "strong",
    maxDaily: 4000,
    needsLabs: true,
  },
  "vitamin-k2": {
    timing: T(MEALS, [], [], ["with"]),
    asks: [],
    watch: ["Stomach upset", "Tell your doctor if you take blood thinners"],
    evidence: "moderate",
    maxDaily: 200,
  },
  "omega-3": {
    timing: T(["dinner", "breakfast"], ["lunch"], ["wake", "bed"], ["with"]),
    asks: [ask("mood", "Mood steadier?"), ask("joints", "Joints less stiff?")],
    watch: ["Fishy burps", "Loose stools", "Easy bruising (with blood thinners)"],
    evidence: "strong",
    maxDaily: 3000,
  },
  ashwagandha: {
    timing: T(["dinner", "bed"], ["breakfast", "lunch"], [], ["with", "empty"]),
    asks: [ask("calm", "Less stressed day to day?"), ask("sleep-quality", "Sleeping better?")],
    watch: [
      "Drowsiness",
      "Stomach upset",
      "Feeling emotionally flat",
      "Racing heart or feeling hot",
    ],
    evidence: "moderate",
    maxDaily: 900,
  },
  rhodiola: {
    timing: T(["wake"], ["breakfast"], ["afternoon", "dinner", "bed"], ["empty", "with"]),
    asks: [ask("energy", "More stamina through the afternoon?")],
    watch: ["Jitteriness", "Trouble sleeping", "Irritability"],
    evidence: "moderate",
    maxDaily: 600,
  },
  bacopa: {
    timing: T(["breakfast", "dinner"], ["lunch"], [], ["with"]),
    asks: [ask("memory", "Remembering things more easily?")],
    watch: ["Stomach cramps or nausea", "Tiredness"],
    evidence: "moderate",
    maxDaily: 600,
  },
  creatine: {
    timing: T(["breakfast", "lunch"], ALL, [], ["with", "empty", "any"]),
    asks: [
      ask("recovery", "Stronger or recovering faster in workouts?"),
      ask("focus", "Mentally sharper when tired?"),
    ],
    watch: ["Bloating", "Stomach upset"],
    evidence: "strong",
    maxDaily: 10,
  },
  zinc: {
    timing: T(["dinner", "lunch"], ["breakfast"], ["wake"], ["with"]),
    asks: [ask("immunity", "Fewer colds or shorter ones?")],
    watch: ["Nausea", "Metallic taste"],
    evidence: "moderate",
    maxDaily: 40,
  },
  "vitamin-c": {
    timing: T(["breakfast", "lunch"], ALL, [], ["with", "empty", "any"]),
    asks: [ask("immunity", "Fewer colds or shorter ones?")],
    watch: ["Loose stools", "Heartburn"],
    evidence: "moderate",
    maxDaily: 2000,
  },
  "vitamin-b12": {
    timing: T(["wake", "breakfast"], ["lunch"], ["bed"], ["empty", "with", "any"]),
    asks: [ask("energy", "More energy through the day?")],
    watch: ["Acne", "Restlessness"],
    evidence: "strong",
    maxDaily: 2000,
    needsLabs: true,
  },
  glycine: {
    timing: T(["bed"], ["dinner"], ["wake", "breakfast"], ["empty", "any"]),
    asks: [ask("sleep-quality", "Sleeping more deeply?")],
    watch: ["Stomach upset", "Daytime drowsiness"],
    evidence: "moderate",
    maxDaily: 5,
  },
  curcumin: {
    timing: T(["dinner", "lunch", "breakfast"], [], [], ["with"]),
    asks: [ask("joints", "Joints less sore or stiff?")],
    watch: ["Stomach upset", "Loose stools"],
    evidence: "moderate",
    maxDaily: 1500,
  },
  coq10: {
    timing: T(["breakfast", "lunch"], ["dinner"], ["bed"], ["with"]),
    asks: [ask("energy", "More energy or stamina?")],
    watch: ["Trouble sleeping", "Stomach upset"],
    evidence: "moderate",
    maxDaily: 300,
  },
  probiotic: {
    timing: T(["wake", "breakfast"], ALL, [], ["empty", "with", "any"]),
    asks: [ask("digestion", "Digestion more comfortable?")],
    watch: ["Bloating or gas (often first week)", "Stomach upset"],
    evidence: "moderate",
  },
  iron: {
    timing: T(["wake"], ["afternoon"], ["breakfast", "dinner"], ["empty"]),
    asks: [ask("energy", "Less tired? (Ferritin labs are the real test.)")],
    watch: ["Constipation", "Nausea", "Stomach pain"],
    evidence: "strong",
    needsLabs: true,
  },
  collagen: {
    timing: T(["breakfast"], ALL, [], ["any", "with", "empty"]),
    asks: [ask("joints", "Joints or skin feeling better?")],
    watch: ["Bloating", "Feeling overly full"],
    evidence: "moderate",
    maxDaily: 20,
  },
  electrolytes: {
    timing: T(["breakfast", "afternoon"], ALL, ["bed"], ["any", "with", "empty"]),
    asks: [ask("energy", "Fewer headaches or energy dips?")],
    watch: ["Swelling in ankles", "Raised blood pressure"],
    evidence: "emerging",
  },
  reishi: {
    timing: T(["dinner", "bed"], ["breakfast"], [], ["with", "empty"]),
    asks: [ask("calm", "Calmer evenings?"), ask("sleep-quality", "Sleeping better?")],
    watch: ["Dry mouth", "Stomach upset", "Dizziness"],
    evidence: "emerging",
    maxDaily: 2000,
  },
  cordyceps: {
    timing: T(["wake", "breakfast"], ["lunch"], ["dinner", "bed"], ["with", "empty"]),
    asks: [ask("energy", "More stamina in exercise?")],
    watch: ["Stomach upset", "Dry mouth"],
    evidence: "emerging",
    maxDaily: 2000,
  },
  "alpha-gpc": {
    timing: T(["wake", "breakfast"], ["lunch"], ["dinner", "bed"], ["with", "empty"]),
    asks: [ask("focus", "Sharper focus within an hour of taking it?")],
    watch: ["Headache", "Heartburn", "Trouble sleeping"],
    evidence: "moderate",
    maxDaily: 600,
  },
  berberine: {
    timing: T(["lunch", "dinner", "breakfast"], [], ["wake", "bed"], ["with"]),
    asks: [ask("energy", "Fewer energy crashes after meals?")],
    watch: ["Constipation or diarrhoea", "Cramping", "Shaky or low-sugar feeling"],
    evidence: "moderate",
    maxDaily: 1500,
  },
  taurine: {
    timing: T(["dinner", "afternoon", "bed"], ALL, [], ["empty", "with", "any"]),
    asks: [ask("calm", "Calmer evenings?")],
    watch: ["Stomach upset", "Dizziness"],
    evidence: "moderate",
    maxDaily: 3000,
  },
  saffron: {
    timing: T(["breakfast"], ["lunch", "dinner"], [], ["with"]),
    asks: [ask("mood", "Mood brighter or steadier?")],
    watch: ["Dry mouth", "Nausea", "Changes in appetite"],
    evidence: "moderate",
    maxDaily: 30,
  },
  apigenin: {
    timing: T(["bed"], [], ["wake", "breakfast", "lunch"], ["any", "empty"]),
    asks: [ask("sleep-onset", "Falling asleep more easily?")],
    watch: ["Morning grogginess", "Daytime drowsiness"],
    evidence: "emerging",
    maxDaily: 100,
  },
  nac: {
    timing: T(["breakfast", "wake"], ALL, [], ["empty", "with", "any"]),
    asks: [ask("general", "Feeling better overall?")],
    watch: ["Nausea", "Stomach upset"],
    evidence: "moderate",
    maxDaily: 1800,
  },
  "b-complex": {
    timing: T(["breakfast"], ["wake", "lunch"], ["dinner", "bed"], ["with"]),
    asks: [ask("energy", "More energy through the day?")],
    watch: ["Nausea on an empty stomach"],
    evidence: "moderate",
  },
};

export const AREA_LABEL: Record<string, string> = {
  focus: "Focus",
  memory: "Memory",
  calm: "Calm",
  "sleep-onset": "Falling asleep",
  "sleep-quality": "Sleep quality",
  muscles: "Muscles",
  energy: "Energy",
  mood: "Mood",
  joints: "Joints",
  recovery: "Recovery",
  immunity: "Immunity",
  digestion: "Digestion",
  general: "Overall",
};

/** Ratings in the language of the question. */
export const AREA_COPY = ["No change", "A little", "Clearly better", "Much better"] as const;

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
  timing: Timing;
  asks: Ask[];
  watch: string[];
  evidence: Evidence;
  maxDaily?: number;
  needsLabs?: boolean;
};

/** Everything Supplime knows about one stack item, with your own overrides on top. */
export function profileFor(item: StackItem): Profile {
  const cat = item.catalogId ? CATALOG_BY_ID[item.catalogId] : undefined;
  const k = item.catalogId ? KNOWLEDGE[item.catalogId] : undefined;
  const o = item.overrides ?? {};
  const x = item.catalogId ? EXTRA[item.catalogId] : undefined;
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
    timing: x?.timing ?? {
      best: item.slots,
      ok: ALL.filter((sl) => !item.slots.includes(sl)),
      avoid: [],
      food: [item.foodTiming],
    },
    asks: x?.asks.length ? x.asks : [ask("general", `Do you notice ${item.name} helping?`)],
    watch: x?.watch ?? [],
    evidence: x?.evidence ?? "emerging",
    maxDaily: x?.maxDaily,
    needsLabs: x?.needsLabs,
  };
}

function defaultRules(item: StackItem): HabitRule[] {
  if (item.foodTiming === "with") return [FOOD];
  if (item.foodTiming === "empty") return [EMPTY];
  return [];
}

/**
 * Next dose above (or below) the current one. With a real bottle the ladder is whole
 * pills (1 → 2 → 3 capsules); otherwise the guide's steps. Never past the usual daily
 * ceiling, counting every time of day you take it.
 */
/**
 * What one pill (capsule, softgel, scoop) holds. From the picked bottle, else the
 * "1 capsule = 150 mg" label, else your starting dose (you almost always start on one pill).
 */
export function unitStrength(item: StackItem): {
  amount: number;
  known: boolean;
  source: "bottle" | "label" | "guess" | "none";
} {
  if (item.product?.dosePerUnit) return { amount: item.product.dosePerUnit, known: true, source: "bottle" };
  const parsed = parseServingLabel(item.servingLabel);
  if (parsed) return { amount: parsed, known: true, source: "label" };
  // Guess from real bottles of this supplement: the strongest pill your starting dose is
  // a whole number of (600 mg Lion's Mane → 600 mg capsules).
  const first = item.doseHistory?.[0]?.amount ?? item.amount;
  const pills = Math.max(1, item.servingsPerDose || 1);
  if (pills > 1) return { amount: item.amount / pills, known: false, source: "guess" };
  const whole = (a: number, b: number) => Math.abs(a / b - Math.round(a / b)) < 1e-6;
  const sizes = item.catalogId
    ? productsFor(item.catalogId)
        .filter((pr) => item.unit === pr.perUnit[0]?.unit || !pr.perUnit[0]?.unit)
        .map((pr) => pr.dosePerUnit)
        .filter((d) => d > 0 && whole(first, d) && whole(item.amount, d))
    : [];
  if (sizes.length) return { amount: Math.max(...sizes), known: false, source: "guess" };
  return { amount: item.amount, known: false, source: "none" };
}

/** "1 capsule = 150 mg", "1 softgel= 3 mg", "2 caps = 1200 mg" → amount per pill. */
export function parseServingLabel(label?: string): number | null {
  if (!label) return null;
  const m = label.match(/(\d+(?:\.\d+)?)\s*[a-z ]*=\s*(\d+(?:[.,]\d+)?)/i);
  if (!m) return null;
  const count = Number(m[1]);
  const amount = Number(m[2]!.replace(",", "."));
  return count > 0 && amount > 0 ? amount / count : null;
}

/** Whole pills for an amount (at least 1). */
export function pillsFor(item: StackItem, amount = item.amount) {
  const s = unitStrength(item).amount;
  return Math.max(1, Math.round(amount / s));
}

/**
 * The next dose up or down. You can only take whole pills, so a step is one pill more
 * or less (150 mg capsules: 150 → 300, never 200), capped by the usual daily ceiling.
 */
export function nextStep(item: StackItem, direction: 1 | -1): number | null {
  const p = profileFor(item);
  const perDay = Math.max(1, item.slots.length);
  const fits = (amount: number) => p.maxDaily === undefined || amount * perDay <= p.maxDaily + 1e-9;
  const strength = unitStrength(item);
  const guideStep = () =>
    direction === 1
      ? (p.steps.find((s) => s > item.amount + 1e-9 && fits(s)) ?? null)
      : ([...p.steps].reverse().find((s) => s < item.amount - 1e-9) ?? null);
  if (strength.source === "none") return guideStep();
  const units = Math.max(1, Math.round(item.amount / strength.amount));
  const next = units + direction;
  // Below one pill means a lower-strength bottle: fall back to the usual lower dose.
  if (next < 1) return guideStep();
  const amount = round(next * strength.amount);
  return direction === 1 && !fits(amount) ? null : amount;
}

/** Pills for an amount of a product (1 decimal max). */
export function unitsFor(item: StackItem, amount = item.amount) {
  if (!item.product) return null;
  return Math.round((amount / item.product.dosePerUnit) * 10) / 10;
}

const round = (n: number) => Math.round(n * 1000) / 1000;

export const ALL_FACTS: { id: string; itemId: string; text: string }[] = Object.entries(
  KNOWLEDGE,
).flatMap(([itemId, k]) => k.facts.map((text, i) => ({ id: `${itemId}:${i}`, itemId, text })));
