import { CATALOG_BY_ID } from "./catalog";
import { activeStack } from "./protocol";
import type { DayContext, DoseLog, StackItem } from "./types";

/**
 * Timing rules per supplement: how late a forgotten dose still makes sense, how close two
 * doses of the same thing may be, and what should be spaced apart. Conservative ranges from
 * NIH ODS fact sheets, LiverTox, MedlinePlus and absorption studies (iron with zinc, coffee,
 * tea and calcium; caffeine and sleep). Not medical advice.
 */
export type Other =
  | "coffee"
  | "tea"
  | "calcium"
  | "dairy"
  | "fibre"
  | "alcohol"
  | "hot-drink"
  | "antibiotic";
export type Separation = {
  with: string;
  /** 0 = they pair well together. */
  hours: number;
  why: string;
  confidence: "good" | "some" | "theoretical";
};
export type MultiDose = "skip-late" | "push-next" | "merge";
export type Timing = {
  /** A forgotten dose still makes sense up to this many hours past its time. */
  lateHours: number;
  lateWhy: string;
  /** Stimulating: not within this many hours of bed. */
  bedCutoffHours?: number;
  /** Sedating: only around bedtime. */
  nearBedOnly?: boolean;
  /** Taken more than once a day: minimum hours between two doses. */
  minGapHours?: number;
  /** A late dose would land too close to the next one: what to do. */
  multiDose?: MultiDose;
  separations: Separation[];
};

const S = (
  w: string,
  hours: number,
  why: string,
  confidence: Separation["confidence"] = "some",
): Separation => ({
  with: w,
  hours,
  why,
  confidence,
});

export const TIMING: Record<string, Timing> = {
  "lions-mane": {
    lateHours: 12,
    lateWhy: "Builds up over weeks: any time today is fine, just never double.",
    separations: [],
  },
  "l-theanine": {
    lateHours: 8,
    lateWhy: "Works the same day: take it late only if you still want the calm now.",
    minGapHours: 3,
    multiDose: "push-next",
    separations: [S("coffee", 0, "Smooths the caffeine jitters", "good")],
  },
  magnesium: {
    lateHours: 12,
    lateWhy: "Builds your stores over days: fine late, never double.",
    minGapHours: 4,
    multiDose: "push-next",
    separations: [
      S("iron", 2, "Magnesium can reduce how much iron you absorb"),
      S(
        "zinc",
        2,
        "They compete for uptake, mainly with high-dose zinc (over 50 mg)",
        "theoretical",
      ),
      S("vitamin-d", 0, "Magnesium helps your body use vitamin D"),
    ],
  },
  "vitamin-d": {
    lateHours: 12,
    lateWhy: "Lasts weeks in your body: any meal today is fine.",
    separations: [S("vitamin-k2", 0, "Often taken together; both need a meal with fat")],
  },
  "vitamin-k2": {
    lateHours: 12,
    lateWhy: "Builds up slowly: take it with a meal with fat any time today.",
    separations: [],
  },
  "omega-3": {
    lateHours: 12,
    lateWhy: "Builds up over weeks: take it with any meal today.",
    separations: [],
  },
  ashwagandha: {
    lateHours: 10,
    lateWhy: "Builds up over weeks: fine late, though it can make you drowsy.",
    minGapHours: 6,
    multiDose: "skip-late",
    separations: [],
  },
  rhodiola: {
    lateHours: 4,
    bedCutoffHours: 8,
    lateWhy: "Stimulating: skip it within 8 h of bed.",
    minGapHours: 4,
    multiDose: "skip-late",
    separations: [],
  },
  bacopa: {
    lateHours: 12,
    lateWhy: "Builds up over 8–12 weeks: fine late with food, never double.",
    separations: [],
  },
  creatine: {
    lateHours: 14,
    lateWhy: "What counts is the daily total: take it whenever you can today.",
    minGapHours: 2,
    multiDose: "merge",
    separations: [],
  },
  zinc: {
    lateHours: 12,
    lateWhy: "Builds up slowly: fine late, never double.",
    separations: [
      S("iron", 1, "They compete for the same uptake; the effect fades within about an hour"),
      S("calcium", 2, "A lot of calcium can reduce zinc absorption"),
      S("dairy", 2, "Calcium in milk can reduce zinc uptake", "theoretical"),
      S("fibre", 2, "Bran and whole grains bind zinc", "good"),
    ],
  },
  "vitamin-c": {
    lateHours: 12,
    lateWhy: "Any time today is fine.",
    minGapHours: 3,
    multiDose: "merge",
    separations: [
      S("iron", 0, "Vitamin C helps you absorb iron", "good"),
      S("vitamin-b12", 2, "Large doses may break down B12 in the gut", "theoretical"),
    ],
  },
  "vitamin-b12": {
    lateHours: 8,
    bedCutoffHours: 6,
    lateWhy: "Builds up slowly, but some people find it energising late in the day.",
    separations: [],
  },
  glycine: {
    lateHours: 2,
    nearBedOnly: true,
    lateWhy: "A sleep aid: only useful near bedtime.",
    separations: [],
  },
  curcumin: {
    lateHours: 12,
    lateWhy: "Builds up slowly: take it with a meal with fat.",
    minGapHours: 4,
    multiDose: "push-next",
    separations: [S("iron", 2, "Curcumin binds iron and may lower how much you absorb")],
  },
  coq10: {
    lateHours: 10,
    lateWhy: "Builds up slowly; take it with food. It can feel energising late in the day.",
    minGapHours: 4,
    multiDose: "push-next",
    separations: [],
  },
  probiotic: {
    lateHours: 12,
    lateWhy: "Taken daily: the exact time matters little.",
    separations: [
      S("hot-drink", 0.5, "Heat can kill the live bacteria", "theoretical"),
      S("antibiotic", 2, "An antibiotic can kill the bacteria in it"),
    ],
  },
  iron: {
    lateHours: 10,
    lateWhy: "Fine later today on an empty stomach, but never double: it upsets the stomach.",
    separations: [
      S("calcium", 2, "Calcium blocks iron absorption", "good"),
      S("dairy", 2, "Calcium in milk cuts iron uptake", "good"),
      S("coffee", 1, "Coffee binds iron: wait 1 h before or 2 h after", "good"),
      S("tea", 1, "Tea sharply cuts iron absorption", "good"),
      S("zinc", 1, "They compete for the same uptake"),
      S("magnesium", 2, "Magnesium can reduce iron uptake"),
      S("curcumin", 2, "Curcumin binds iron"),
      S("fibre", 2, "Bran and whole grains bind iron", "good"),
      S("vitamin-c", 0, "Take together: vitamin C boosts iron absorption", "good"),
    ],
  },
  melatonin: {
    lateHours: 1,
    nearBedOnly: true,
    lateWhy: "Only if you still have 7+ hours to sleep, or you'll be groggy tomorrow.",
    separations: [
      S("coffee", 6, "Caffeine works against melatonin", "good"),
      S("alcohol", 3, "More drowsiness, and alcohol breaks up sleep"),
    ],
  },
  collagen: { lateHours: 14, lateWhy: "Builds up slowly: any time today.", separations: [] },
  electrolytes: {
    lateHours: 12,
    lateWhy: "For today's hydration: take it when you need it.",
    minGapHours: 1,
    multiDose: "push-next",
    separations: [],
  },
  reishi: {
    lateHours: 3,
    lateWhy: "Mildly calming: fine in the evening, skip it the next morning.",
    minGapHours: 6,
    multiDose: "skip-late",
    separations: [],
  },
  cordyceps: {
    lateHours: 4,
    bedCutoffHours: 6,
    lateWhy: "Energising: skip it close to bed.",
    minGapHours: 4,
    multiDose: "skip-late",
    separations: [],
  },
  "alpha-gpc": {
    lateHours: 4,
    bedCutoffHours: 6,
    lateWhy: "A same-day focus effect that can disturb sleep.",
    minGapHours: 4,
    multiDose: "skip-late",
    separations: [],
  },
  berberine: {
    lateHours: 3,
    lateWhy: "Works with meals: take it late only with a meal.",
    minGapHours: 4,
    multiDose: "skip-late",
    separations: [],
  },
  taurine: {
    lateHours: 12,
    lateWhy: "Any time today.",
    minGapHours: 4,
    multiDose: "push-next",
    separations: [],
  },
  saffron: {
    lateHours: 12,
    lateWhy: "The mood effect builds over weeks.",
    minGapHours: 6,
    multiDose: "push-next",
    separations: [],
  },
  apigenin: {
    lateHours: 2,
    nearBedOnly: true,
    lateWhy: "A sleep aid: only near bedtime.",
    separations: [],
  },
  nac: {
    lateHours: 12,
    lateWhy: "Builds up over time: fine late.",
    minGapHours: 4,
    multiDose: "push-next",
    separations: [],
  },
  "b-complex": {
    lateHours: 6,
    bedCutoffHours: 6,
    lateWhy: "Can feel energising and keep you up.",
    separations: [],
  },
};

const DEFAULT: Timing = {
  lateHours: 10,
  lateWhy: "Fine later today; never double.",
  separations: [],
};

export function timingFor(item: Pick<StackItem, "catalogId">): Timing {
  return (item.catalogId && TIMING[item.catalogId]) || DEFAULT;
}

const OTHER_LABEL: Record<Other, string> = {
  coffee: "coffee",
  tea: "tea",
  calcium: "calcium",
  dairy: "dairy",
  fibre: "high-fibre food",
  alcohol: "alcohol",
  "hot-drink": "hot drinks",
  antibiotic: "antibiotics",
};

/** Every separation that applies between two supplements (rules are stored on either side). */
export function separationBetween(a: StackItem, b: StackItem): Separation | undefined {
  if (!a.catalogId || !b.catalogId || a.catalogId === b.catalogId) return undefined;
  const fromA = timingFor(a).separations.find((s) => s.with === b.catalogId);
  const fromB = timingFor(b).separations.find((s) => s.with === a.catalogId);
  if (fromA && fromB) return fromA.hours >= fromB.hours ? fromA : fromB;
  return fromA ?? fromB;
}

export function otherLabel(w: string) {
  return OTHER_LABEL[w as Other] ?? CATALOG_BY_ID[w]?.name ?? w;
}

export type TakeCheck = {
  tone: "warn" | "good";
  text: string;
  /** When it would be fine (minutes since midnight, real clock). */
  waitUntil?: number;
};

/**
 * Right before you take something: is anything you took (or drank) today too close?
 * `nowMin` and the logged times are minutes since midnight on the real clock.
 */
export function takeNowChecks(input: {
  item: StackItem;
  stack: StackItem[];
  logs: DoseLog[];
  day?: DayContext;
  date: string;
  nowMin: number;
}): TakeCheck[] {
  const { item, stack, logs, day, date, nowMin } = input;
  const out: TakeCheck[] = [];
  const minutesOf = (iso: string) => {
    const d = new Date(iso);
    return d.getHours() * 60 + d.getMinutes();
  };
  const clock = (m: number) => {
    const h = Math.floor(m / 60) % 24;
    const mm = String(m % 60).padStart(2, "0");
    return `${h % 12 || 12}:${mm} ${h < 12 ? "am" : "pm"}`;
  };
  const takenToday = logs.filter(
    (l) => l.date === date && l.status === "taken" && l.itemId !== item.id,
  );
  for (const other of activeStack(stack)) {
    if (other.id === item.id) continue;
    const sep = separationBetween(item, other);
    if (!sep) continue;
    const log = takenToday.filter((l) => l.itemId === other.id).at(-1);
    if (!log) continue;
    const at = minutesOf(log.at);
    const since = nowMin - at;
    if (sep.hours === 0) {
      if (Math.abs(since) <= 60)
        out.push({
          tone: "good",
          text: `Good timing with ${other.name}: ${sep.why.toLowerCase()}.`,
        });
      continue;
    }
    const need = Math.round(sep.hours * 60);
    if (since >= 0 && since < need) {
      out.push({
        tone: "warn",
        text: `You took ${other.name} at ${clock(at)}. ${sep.why}. Best from ${clock(at + need)}.`,
        waitUntil: at + need,
      });
    }
  }
  for (const sep of timingFor(item).separations) {
    if (sep.with !== "coffee" && sep.with !== "alcohol") continue;
    const times = (sep.with === "coffee" ? day?.coffeeAt : day?.alcoholAt) ?? [];
    const last = times
      .map((t) => {
        const [h, m] = t.split(":").map(Number);
        return (h ?? 0) * 60 + (m ?? 0);
      })
      .filter((m) => m <= nowMin)
      .sort((a, b) => a - b)
      .at(-1);
    if (last === undefined) continue;
    const need = Math.round(sep.hours * 60);
    if (sep.hours === 0) continue;
    if (nowMin - last < need) {
      out.push({
        tone: "warn",
        text: `You had ${otherLabel(sep.with)} at ${clock(last)}. ${sep.why}. Best from ${clock(last + need)}.`,
        waitUntil: last + need,
      });
    }
  }
  return out;
}

/** Combinations worth a gentle heads-up when they're in your cabinet together. */
const GROUPS: { ids: string[]; min: number; text: string }[] = [
  {
    ids: ["ashwagandha", "melatonin", "reishi", "apigenin", "glycine", "magnesium"],
    min: 3,
    text: "Several calming supplements together add up: if you feel groggy in the morning, drop one or take them earlier.",
  },
  {
    ids: ["omega-3", "curcumin", "reishi"],
    min: 2,
    text: "Each can slightly slow blood clotting. Fine for most people; check with a doctor if you take blood thinners or have surgery coming up.",
  },
  {
    ids: ["berberine", "cordyceps"],
    min: 2,
    text: "Both can lower blood sugar. Watch for shakiness, and check with a doctor if you take diabetes medication.",
  },
  {
    ids: ["rhodiola", "alpha-gpc", "cordyceps"],
    min: 2,
    text: "Several energising supplements, on top of coffee, can make you jittery or sleep worse. Keep them to the morning.",
  },
];

export function stackCautions(stack: StackItem[]) {
  const ids = new Set(
    activeStack(stack)
      .map((i) => i.catalogId)
      .filter(Boolean) as string[],
  );
  return GROUPS.filter((g) => g.ids.filter((id) => ids.has(id)).length >= g.min).map((g) => ({
    names: g.ids.filter((id) => ids.has(id)).map((id) => CATALOG_BY_ID[id]?.name ?? id),
    text: g.text,
  }));
}
