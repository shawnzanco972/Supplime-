import { CATALOG_BY_ID, foodLabel } from "./catalog";
import type {
  DayContext,
  FoodTiming,
  Profile,
  Rhythm,
  SlotId,
  SlotTimes,
  StackItem,
} from "./types";
import { SLOTS, WAKE_RELATIVE } from "./types";
import { addDays, formatHHMM, parseHHMM, todayKey } from "./utils";

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
  /** Minutes since the start of your day's calendar date; can exceed 1440 for after-midnight. */
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

/* ------------------------------------------------------------------ rhythm */

export function defaultRhythm(): Rhythm {
  return {
    wake: "07:00",
    eatsBreakfast: true,
    firstMeal: "08:00",
    lastMeal: "19:00",
    bed: "23:00",
    home: "18:30",
    flexibleWake: false,
  };
}

const round15 = (m: number) => Math.round(m / 15) * 15;

/**
 * Minutes into *your* day for a clock time. Anything earlier than a few hours before
 * waking is treated as after midnight (a 01:00 bedtime is 25:00, not 01:00).
 */
export function dayMinutes(time: string, wake: string) {
  const m = parseHHMM(time);
  return m < dayStart(wake) ? m + 1440 : m;
}

/** Your day starts 3 hours before you usually wake (never before 03:00). */
export function dayStart(wake: string) {
  return Math.max(180, parseHHMM(wake) - 180);
}

/** Turn your day (wake, meals, bed) into the six windows. */
export function slotTimesFromRhythm(r: Rhythm): SlotTimes {
  const wake = parseHHMM(r.wake);
  const first = dayMinutes(r.firstMeal, r.wake);
  const last = Math.max(first + 180, dayMinutes(r.lastMeal, r.wake));
  const bed = Math.max(last + 60, dayMinutes(r.bed, r.wake));
  const second = round15(first + (last - first) / 2);
  const afternoon = round15(second + (last - second) / 2);
  return {
    wake: formatHHMM(wake),
    breakfast: formatHHMM(first),
    lunch: formatHHMM(second),
    afternoon: formatHHMM(Math.min(afternoon, last - 60)),
    dinner: formatHHMM(last),
    // Sleep aids want 30–60 minutes before lights out.
    bed: formatHHMM(bed - 30),
  };
}

export function defaultSlotTimes(): SlotTimes {
  return slotTimesFromRhythm(defaultRhythm());
}

/**
 * Which calendar day a moment belongs to in your rhythm. Taking melatonin at 01:30
 * counts for the day you are finishing, not the one that started at midnight.
 */
export function logicalDate(now: Date, rhythm: Pick<Rhythm, "wake">) {
  const m = now.getHours() * 60 + now.getMinutes();
  const today = todayKey(now);
  return m < dayStart(rhythm.wake) ? addDays(today, -1) : today;
}

/** Minutes into the logical day for `now` (past midnight counts as 24:xx). */
export function nowInDay(now: Date, rhythm: Pick<Rhythm, "wake">) {
  const m = now.getHours() * 60 + now.getMinutes();
  return m < dayStart(rhythm.wake) ? m + 1440 : m;
}

/**
 * Today's actual windows. If you tapped "I'm up" later (or earlier) than planned, the
 * waking-relative windows move with you; the evening ones stay put.
 */
export function effectiveSlotTimes(
  profile: Pick<Profile, "slotTimes" | "rhythm">,
  days: DayContext[],
  date: string,
): { times: SlotTimes; shift: number; wokeAt?: string } {
  const base = profile.slotTimes;
  const ctx = days.find((d) => d.date === date);
  if (!ctx?.wokeAt) return { times: base, shift: 0 };
  const wake = profile.rhythm.wake;
  const shift = dayMinutes(ctx.wokeAt, wake) - dayMinutes(base.wake, wake);
  const times = { ...base };
  const lastMeal = dayMinutes(base.dinner, wake);
  for (const slot of WAKE_RELATIVE) {
    let m = dayMinutes(base[slot], wake) + shift;
    if (slot !== "wake") m = Math.min(m, lastMeal - 45);
    times[slot] = formatHHMM(Math.max(0, m));
  }
  return { times, shift, wokeAt: ctx.wokeAt };
}

/* ------------------------------------------------------------------ planning */

export function activeStack(stack: StackItem[]) {
  return stack.filter(
    (item) => !item.paused && !item.archived && !item.planned && item.slots.length > 0,
  );
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

export function planDay(
  stack: StackItem[],
  slotTimes: SlotTimes,
  nowMinutes: number,
  wake: string = slotTimes.wake,
): SlotPlan[] {
  const doses = scheduledDoses(stack);
  return SLOTS.map((slot) => {
    const time = slotTimes[slot.id] ?? slot.defaultTime;
    const minutes = slot.id === "wake" ? parseHHMM(time) : dayMinutes(time, wake);
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
    else if (nowMinutes >= minutes - 20 && nowMinutes <= minutes + 90) status = "due";
    else if (nowMinutes < minutes - 20) status = "upcoming";

    return { slot, time, minutes, waves, doseCount: slotDoses.length, status };
  })
    .filter((plan) => plan.doseCount > 0)
    .sort((a, b) => a.minutes - b.minutes);
}

export function nextSlot(plans: SlotPlan[], remaining: Set<string>, nowMinutes: number) {
  const withLeft = plans.filter((plan) =>
    plan.waves.some((wave) => wave.doses.some((d) => remaining.has(doseKey(d)))),
  );
  if (withLeft.length === 0) return null;
  const upcoming = withLeft
    .map((plan) => ({ plan, delta: plan.minutes - nowMinutes }))
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
  const food = catalog?.foodTiming ?? item.foodTiming;
  if (
    food === "empty" &&
    item.slots.some((s) => s === "breakfast" || s === "lunch" || s === "dinner")
  ) {
    return `${item.name} prefers an empty stomach. The waking window suits it better than a meal.`;
  }
  if (food === "with" && item.slots.includes("wake")) {
    return `${item.name} absorbs better with food. Move it to your first meal instead of on waking.`;
  }
  return null;
}

export function clusterNote(waves: Wave[]) {
  const keys = new Set(waves.map((w) => w.key));
  if (keys.has("empty") && (keys.has("with") || keys.has("after"))) {
    return "Split this window: empty-stomach capsules first, then eat, then the rest.";
  }
  if (keys.has("with")) {
    return "Take the with-food ones together with the meal.";
  }
  return null;
}
