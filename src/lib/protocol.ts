import { CATALOG_BY_ID, foodLabel } from "./catalog";
import type { FoodTiming, SlotId, SlotTimes, StackItem } from "./types";
import { SLOTS } from "./types";
import { minutesNow, parseHHMM } from "./utils";

export type PlannedDose = {
  item: StackItem;
  slot: SlotId;
};

export type Wave = {
  key: FoodTiming;
  title: string;
  instruction: string;
  waitMinutes: number;
  doses: PlannedDose[];
};

export type SlotPlan = {
  slot: (typeof SLOTS)[number];
  time: string;
  minutes: number;
  waves: Wave[];
  doseCount: number;
  status: "upcoming" | "due" | "later" | "done";
};

const WAVE_META: Record<
  FoodTiming,
  { title: string; instruction: string; waitMinutes: number; order: number }
> = {
  empty: {
    title: "Empty stomach",
    instruction: "Take these first, 20–30 minutes before food.",
    waitMinutes: 0,
    order: 0,
  },
  with: {
    title: "With food",
    instruction: "Swallow these with the meal — fat-soluble ones need real food, not coffee alone.",
    waitMinutes: 25,
    order: 1,
  },
  after: {
    title: "After food",
    instruction: "Wait until you have eaten, then take these.",
    waitMinutes: 40,
    order: 2,
  },
  any: {
    title: "Anytime in this window",
    instruction: "These can ride with the meal or on their own.",
    waitMinutes: 25,
    order: 1,
  },
};

export function defaultSlotTimes(): SlotTimes {
  return Object.fromEntries(SLOTS.map((s) => [s.id, s.defaultTime])) as SlotTimes;
}

export function activeStack(stack: StackItem[]) {
  return stack.filter((item) => !item.paused && item.slots.length > 0);
}

export function scheduledDoses(stack: StackItem[]): PlannedDose[] {
  const doses: PlannedDose[] = [];
  for (const item of activeStack(stack)) {
    for (const slot of item.slots) {
      doses.push({ item, slot });
    }
  }
  return doses;
}

export function planDay(stack: StackItem[], slotTimes: SlotTimes): SlotPlan[] {
  const now = minutesNow();
  const doses = scheduledDoses(stack);
  return SLOTS.map((slot) => {
    const time = slotTimes[slot.id] ?? slot.defaultTime;
    const minutes = parseHHMM(time);
    const slotDoses = doses.filter((d) => d.slot === slot.id);
    const grouped = new Map<FoodTiming, PlannedDose[]>();
    for (const dose of slotDoses) {
      const key = dose.item.foodTiming;
      const list = grouped.get(key) ?? [];
      list.push(dose);
      grouped.set(key, list);
    }
    const waves: Wave[] = [...grouped.entries()]
      .sort((a, b) => WAVE_META[a[0]].order - WAVE_META[b[0]].order)
      .map(([key, list]) => ({
        key,
        title: WAVE_META[key].title,
        instruction: WAVE_META[key].instruction,
        waitMinutes: key === "empty" ? 0 : WAVE_META[key].waitMinutes,
        doses: list,
      }));

    let status: SlotPlan["status"] = "later";
    if (slotDoses.length === 0) status = "done";
    else if (now >= minutes - 20 && now <= minutes + 90) status = "due";
    else if (now < minutes - 20) status = "upcoming";
    else status = "later";

    return {
      slot,
      time,
      minutes,
      waves,
      doseCount: slotDoses.length,
      status,
    };
  }).filter((plan) => plan.doseCount > 0);
}

export function nextSlot(plans: SlotPlan[], remaining: Set<string>) {
  const now = minutesNow();
  const withLeft = plans.filter((plan) =>
    plan.waves.some((wave) => wave.doses.some((d) => remaining.has(doseKey(d)))),
  );
  if (withLeft.length === 0) return null;
  const upcoming = withLeft
    .map((plan) => ({ plan, delta: plan.minutes - now }))
    .sort((a, b) => {
      const aDue = a.delta <= 90 ? 0 : 1;
      const bDue = b.delta <= 90 ? 0 : 1;
      if (aDue !== bDue) return aDue - bDue;
      return Math.abs(a.delta) - Math.abs(b.delta);
    });
  return upcoming[0]?.plan ?? null;
}

export function doseKey(dose: PlannedDose) {
  return `${dose.item.id}:${dose.slot}`;
}

export function foodChip(item: StackItem) {
  return foodLabel(item.foodTiming);
}

export function timingConflict(item: StackItem) {
  const catalog = item.catalogId ? CATALOG_BY_ID[item.catalogId] : undefined;
  if (!catalog) return null;
  const preferred = new Set(catalog.preferredSlots);
  const odd = item.slots.filter((slot) => !preferred.has(slot));
  if (odd.length === 0) return null;
  if (
    catalog.foodTiming === "empty" &&
    item.slots.some((s) => s === "breakfast" || s === "lunch" || s === "dinner")
  ) {
    return `${item.name} prefers an empty stomach. Consider the waking slot, not a meal.`;
  }
  if (catalog.foodTiming === "with" && item.slots.includes("wake")) {
    return `${item.name} absorbs better with food — breakfast or dinner beats an empty waking dose.`;
  }
  return null;
}

export function clusterNote(waves: Wave[]) {
  const keys = new Set(waves.map((w) => w.key));
  if (keys.has("empty") && (keys.has("with") || keys.has("after"))) {
    return "Split this window: empty-stomach capsules first, then eat, then the rest.";
  }
  if (keys.has("with")) {
    return "Take the with-food cluster together so fat-soluble vitamins share the meal.";
  }
  return null;
}
