import { beforeEach, describe, expect, it, vi } from "vitest";
import { advise, backfillLogs, beforeAfter, nextAsk, safetyDue } from "@/lib/advisor";
import { PRODUCT_BY_ID, contentsLabel, matchProduct } from "@/lib/products";
import { coffeeTips, doseFlags } from "@/lib/flags";
import {
  bonusDay,
  levelFor,
  streakWithShields,
  todaysInsight,
  totalXp,
  weekProgress,
} from "@/lib/game";
import { parseProduct } from "@/lib/iherb";
import { journeyFor } from "@/lib/journey";
import { nextStep, profileFor } from "@/lib/knowledge";
import { missedAdvice } from "@/lib/missed";
import { buildSchedule } from "@/lib/notifications";
import {
  dayMinutes,
  defaultRhythm,
  effectiveSlotTimes,
  logicalDate,
  slotTimesFromRhythm,
} from "@/lib/protocol";
import {
  currentStep,
  dayAdherence,
  daysAtDose,
  effectWindow,
  firstFelt,
  remainingKeys,
} from "@/lib/stats";
import { defaultHabits, normalizeData, useSupplime } from "@/lib/store";
import type { Rhythm } from "@/lib/types";
import { addDays } from "@/lib/utils";

const TODAY = "2026-10-06";

const rhythm = (patch: Partial<Rhythm> = {}): Rhythm => ({ ...defaultRhythm(), ...patch });

function setup(ids = ["lions-mane", "l-theanine", "melatonin"], r: Partial<Rhythm> = {}) {
  useSupplime.getState().resetAll();
  useSupplime.getState().completeOnboarding({
    displayName: "Test",
    why: "Sharper focus",
    goals: [],
    rhythm: rhythm(r),
    habits: defaultHabits(),
    items: ids.map((catalogId) => ({ catalogId })),
    notifications: true,
  });
}

const s = () => useSupplime.getState();
const byCat = (id: string) => s().stack.find((i) => i.catalogId === id)!;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 6, 9, 0, 0));
  setup();
});

describe("your rhythm", () => {
  it("builds windows from wake, meals and bedtime", () => {
    const t = slotTimesFromRhythm(
      rhythm({
        wake: "10:30",
        eatsBreakfast: false,
        firstMeal: "13:00",
        lastMeal: "20:00",
        bed: "01:00",
      }),
    );
    expect(t).toEqual({
      wake: "10:30",
      breakfast: "13:00",
      lunch: "16:30",
      afternoon: "18:15",
      dinner: "20:00",
      bed: "00:30",
    });
  });

  it("counts after-midnight as the same day", () => {
    expect(dayMinutes("00:30", "10:30")).toBe(24 * 60 + 30);
    expect(logicalDate(new Date(2026, 9, 7, 1, 30), { wake: "10:30" })).toBe("2026-10-06");
    expect(logicalDate(new Date(2026, 9, 7, 8, 0), { wake: "10:30" })).toBe("2026-10-07");
  });

  it("moves the morning when you get up late, but not the rest of the day", () => {
    const profile = { slotTimes: slotTimesFromRhythm(rhythm()), rhythm: rhythm() };
    expect(profile.slotTimes.lunch).toBe("13:30");
    const { times, shift } = effectiveSlotTimes(profile, [{ date: TODAY, wokeAt: "09:30" }], TODAY);
    expect(shift).toBe(150);
    expect(times.wake).toBe("09:30");
    expect(times.breakfast).toBe("10:30");
    expect(times.lunch).toBe("13:30"); // still on the clock (≥ 2.5 h after the first meal)
    expect(times.afternoon).toBe(profile.slotTimes.afternoon);
    expect(times.dinner).toBe("19:00");
    expect(times.bed).toBe(profile.slotTimes.bed);
  });

  it("only pushes later windows enough to keep the gaps", () => {
    const profile = { slotTimes: slotTimesFromRhythm(rhythm()), rhythm: rhythm() };
    const { times } = effectiveSlotTimes(profile, [{ date: TODAY, wokeAt: "11:30" }], TODAY);
    expect(times.breakfast).toBe("12:30");
    expect(times.lunch).toBe("15:00"); // 2.5 h after the first meal, not +4.5 h
    expect(times.afternoon).toBe("16:30");
  });

  it("an early start doesn't drag lunch earlier", () => {
    const profile = { slotTimes: slotTimesFromRhythm(rhythm()), rhythm: rhythm() };
    const { times } = effectiveSlotTimes(profile, [{ date: TODAY, wokeAt: "05:30" }], TODAY);
    expect(times.wake).toBe("05:30");
    expect(times.breakfast).toBe("06:30");
    expect(times.lunch).toBe("13:30");
  });
});

describe("knowledge: how long until it works", () => {
  it("knows each of your supplements' timeline", () => {
    const lm = profileFor(byCat("lions-mane"));
    expect([lm.firstSignsDay, lm.typicalDay, lm.minDaysBeforeIncrease, lm.evaluateDay]).toEqual([
      7, 21, 28, 56,
    ]);
    const mel = profileFor(byCat("melatonin"));
    expect(mel.kind).toBe("acute");
    expect(mel.rules.find((r) => r.kind === "avoid-alcohol")?.hours).toBe(4);
    expect(nextStep(byCat("lions-mane"), 1)).toBe(1500);
    expect(nextStep(byCat("melatonin"), -1)).toBe(0.5);
  });

  it("restarts the dose clock on a new step but keeps the overall day count", () => {
    s().updateItem(byCat("lions-mane").id, { startedAt: addDays(TODAY, -20) });
    expect(daysAtDose(byCat("lions-mane"), TODAY)).toBe(21);
    s().changeDose(byCat("lions-mane").id, 1500);
    const item = byCat("lions-mane");
    expect(item.doseHistory.map((x) => x.amount)).toEqual([1000, 1500]);
    expect(effectWindow(item, TODAY)).toMatchObject({
      elapsed: 21,
      atDose: 1,
      readyToIncrease: false,
    });
  });

  it("treats a dose fix as a correction, not a new step", () => {
    s().updateItem(byCat("lions-mane").id, { startedAt: addDays(TODAY, -10) });
    s().saveItem(byCat("lions-mane").id, { amount: 500, doseChange: "correction" });
    expect(byCat("lions-mane").doseHistory).toEqual([
      { date: addDays(TODAY, -10), amount: 500, unit: "mg" },
    ]);
    expect(currentStep(byCat("lions-mane")).amount).toBe(500);
  });
});

describe("journey and verdicts", () => {
  const journey = () =>
    journeyFor({
      item: byCat("lions-mane"),
      logs: s().logs,
      effects: s().effects,
      decisions: s().decisions,
      today: TODAY,
    });

  it("says too early before the typical onset", () => {
    s().updateItem(byCat("lions-mane").id, { startedAt: addDays(TODAY, -9) });
    expect(journey().recommendation.kind).toBe("more-time");
    expect(journey().next?.key).toBe("typical");
  });

  it("recommends a step up after enough consistent days without effect", () => {
    const id = byCat("lions-mane").id;
    s().updateItem(id, { startedAt: addDays(TODAY, -29) });
    for (let i = 0; i < 30; i++) s().logDose(id, "breakfast", "taken", addDays(TODAY, -i));
    s().logEffect(id, 0);
    expect(journey().recommendation).toMatchObject({ kind: "step-up", to: 1500 });
  });

  it("calls out an unfair test when doses were missed", () => {
    const id = byCat("lions-mane").id;
    s().updateItem(id, { startedAt: addDays(TODAY, -29) });
    for (let i = 0; i < 30; i += 3) s().logDose(id, "breakfast", "taken", addDays(TODAY, -i));
    expect(journey().recommendation.title).toBe("Not a fair test yet");
  });

  it("keeps a dose that works and stops on request", () => {
    const id = byCat("lions-mane").id;
    s().updateItem(id, { startedAt: addDays(TODAY, -55) });
    s().logEffect(id, 3);
    expect(journey().recommendation.kind).toBe("keep");
    expect(journey().evaluateDue).toBe(true);
    s().decide(id, "keep", { note: "Clearer mornings" });
    expect(journey().evaluateDue).toBe(false);
    s().decide(id, "stop", { verdict: "worked" });
    expect(byCat("lions-mane").archived?.verdict).toBe("worked");
    expect(remainingKeys(s().stack, s().logs, TODAY).has(`${id}:breakfast`)).toBe(false);
  });

  it("suggests lowering after side effects", () => {
    const id = byCat("melatonin").id;
    s().logEffect(id, 2, { sideEffects: true });
    const j = journeyFor({
      item: byCat("melatonin"),
      logs: s().logs,
      effects: s().effects,
      decisions: [],
      today: TODAY,
    });
    // Below one pill: switch to a lower-strength bottle (Life Extension 300 mcg).
    expect(j.recommendation).toMatchObject({ kind: "lower", to: 0.3 });
    expect(j.recommendation.swap?.product.brand).toBe("Life Extension");
  });

  it("records the first day you felt it", () => {
    const id = byCat("lions-mane").id;
    s().updateItem(id, { startedAt: addDays(TODAY, -15) });
    s().logEffect(id, 1, { date: addDays(TODAY, -3) });
    s().logEffect(id, 2);
    expect(firstFelt(byCat("lions-mane"), s().effects)?.day).toBe(16);
  });
});

describe("missed doses", () => {
  const ctx = (now: string, r: Partial<Rhythm> = {}) => {
    const rr = rhythm(r);
    return { now: dayMinutes(now, rr.wake), times: slotTimesFromRhythm(rr), rhythm: rr };
  };

  it("catches up a slow builder with your next meal once home", () => {
    const a = missedAdvice({
      item: byCat("lions-mane"),
      slot: "breakfast",
      reason: "not-with-me",
      ...ctx("10:00"),
    });
    expect(a.action).toBe("catch-up");
    expect(a.suggestAt).toBe("19:00");
  });

  it("does not ask you to catch up theanine", () => {
    const a = missedAdvice({
      item: byCat("l-theanine"),
      slot: "breakfast",
      reason: "forgot",
      ...ctx("11:00"),
    });
    expect(a.action).toBe("optional");
  });

  it("skips melatonin when it's too late", () => {
    const late = missedAdvice({
      item: byCat("melatonin"),
      slot: "bed",
      reason: "forgot",
      ...ctx("01:30"),
    });
    expect(late.action).toBe("skip");
    const ok = missedAdvice({
      item: byCat("melatonin"),
      slot: "bed",
      reason: "not-with-me",
      ...ctx("22:40"),
    });
    expect(ok.action).toBe("catch-up");
  });

  it("skips stimulating supplements in the evening", () => {
    setup(["rhodiola"]);
    const a = missedAdvice({
      item: byCat("rhodiola"),
      slot: "wake",
      reason: "not-with-me",
      ...ctx("09:00"),
    });
    expect(a.action).toBe("skip");
  });

  it("keeps a deferred dose open and counts it when taken late", () => {
    const id = byCat("lions-mane").id;
    s().deferDose(id, "breakfast", "19:00", "not-with-me");
    expect(remainingKeys(s().stack, s().logs, TODAY).has(`${id}:breakfast`)).toBe(true);
    s().logDose(id, "breakfast", "taken", TODAY, { late: true });
    expect(dayAdherence(s().stack, s().logs, TODAY)).toMatchObject({ taken: 1, late: 1 });
  });
});

describe("habit flags", () => {
  it("warns about alcohol before melatonin and pairs theanine with coffee", () => {
    const profile = { rhythm: rhythm(), habits: defaultHabits() };
    const times = slotTimesFromRhythm(profile.rhythm);
    const mel = doseFlags({
      item: byCat("melatonin"),
      slot: "bed",
      times,
      profile,
      stack: s().stack,
      day: { date: TODAY, alcoholAt: ["21:00"] },
    });
    expect(mel[0]).toMatchObject({ tone: "warn", icon: "alcohol" });
    const th = doseFlags({
      item: byCat("l-theanine"),
      slot: "breakfast",
      times,
      profile,
      stack: s().stack,
    });
    expect(th.some((f) => f.tone === "good" && f.icon === "coffee")).toBe(true);
  });

  it("flags food-needing supplements in a no-food window", () => {
    setup(["omega-3"]);
    const profile = { rhythm: rhythm(), habits: defaultHabits() };
    const flags = doseFlags({
      item: byCat("omega-3"),
      slot: "wake",
      times: slotTimesFromRhythm(profile.rhythm),
      profile,
      stack: s().stack,
    });
    expect(flags[0]?.tone).toBe("warn");
  });
});

describe("gamification", () => {
  it("earns shields and spends one instead of breaking the streak", () => {
    const ids = s().stack.map((i) => i.id);
    s().setProfile({ joinedAt: addDays(TODAY, -9) });
    for (const id of ids) s().updateItem(id, { startedAt: addDays(TODAY, -9) });
    for (let d = -9; d <= -1; d++) {
      if (d === -2) continue; // a bad day
      for (const item of s().stack)
        for (const slot of item.slots) s().logDose(item.id, slot, "taken", addDays(TODAY, d));
    }
    const st = streakWithShields(s(), TODAY);
    expect(st.days.find((x) => x.date === addDays(TODAY, -2))?.outcome).toBe("shielded");
    expect(st.streak).toBe(8);
    expect(st.shields).toBe(0);
  });

  it("doesn't judge days before you joined, even for backdated supplements", () => {
    s().updateItem(byCat("lions-mane").id, { startedAt: addDays(TODAY, -30) });
    const st = streakWithShields(s(), TODAY);
    expect(st.days.some((d) => d.outcome === "broken")).toBe(false);
  });

  it("asks for a check-in before suggesting a dose change, and never pushes melatonin up", () => {
    const id = byCat("melatonin").id;
    s().updateItem(id, { startedAt: addDays(TODAY, -10) });
    const j = () =>
      journeyFor({
        item: byCat("melatonin"),
        logs: s().logs,
        effects: s().effects,
        decisions: [],
        today: TODAY,
      });
    expect(j().recommendation.title).toBe("Check in first");
    s().logEffect(id, 0);
    expect(j().recommendation.kind).toBe("keep");
    expect(j().recommendation.why).toMatch(/timing|same time/);
  });

  it("derives XP and levels from what you did", () => {
    const id = byCat("lions-mane").id;
    const base = totalXp(s(), TODAY); // milestones reached on day 1 (same-day supplements)
    s().logDose(id, "breakfast", "taken");
    s().logEffect(id, 1);
    expect(totalXp(s(), TODAY) - base).toBe(10 + 15);
    expect(levelFor(260)).toMatchObject({ level: 3, name: "Seedling" });
    expect(weekProgress(s(), TODAY).taken).toBe(1);
    expect(typeof bonusDay(TODAY)).toBe("boolean");
  });

  it("unlocks an insight about your own supplements once the day is complete", () => {
    expect(todaysInsight(s(), TODAY).canUnlock).toBe(false);
    for (const item of s().stack)
      for (const slot of item.slots) s().logDose(item.id, slot, "taken");
    const ins = todaysInsight(s(), TODAY);
    expect(ins.canUnlock).toBe(true);
    expect(["lions-mane", "l-theanine", "melatonin"]).toContain(ins.fact.itemId);
    s().revealFact(ins.fact.id);
    expect(todaysInsight(s(), TODAY).unlocked).toBe(true);
  });
});

describe("iHerb", () => {
  it("reads a shared product title", () => {
    const p = parseProduct(
      "Check out NOW Foods, L-Theanine, Double Strength, 200 mg, 120 Veg Capsules on iHerb! https://iherb.co/x1",
    );
    expect(p).toMatchObject({
      brand: "NOW Foods",
      name: "L-Theanine",
      amount: 200,
      unit: "mg",
      count: 120,
      catalogId: "l-theanine",
    });
  });

  it("reads a product URL slug, including decimal doses", () => {
    const p = parseProduct(
      "https://www.iherb.com/pr/natrol-melatonin-fast-dissolve-0-5-mg-200-tablets/12345",
    );
    expect(p).toMatchObject({
      brand: "Natrol",
      amount: 0.5,
      unit: "mg",
      count: 200,
      catalogId: "melatonin",
    });
    const lm = parseProduct(
      "https://il.iherb.com/pr/california-gold-nutrition-lion-s-mane-mushroom-1000-mg-60-veggie-capsules/98765",
    );
    expect(lm).toMatchObject({
      brand: "California Gold Nutrition",
      name: "Lion's Mane Mushroom",
      amount: 1000,
      count: 60,
      catalogId: "lions-mane",
    });
  });

  it("returns a custom product when the guide doesn't know it", () => {
    const p = parseProduct("Jarrow Formulas, PQQ, 20 mg, 30 Capsules");
    expect(p).toMatchObject({ brand: "Jarrow Formulas", name: "PQQ", amount: 20, count: 30 });
    expect(p?.catalogId).toBeUndefined();
  });
});

describe("reminders", () => {
  it("schedules two weeks of windows, nudges, and catch-ups", () => {
    const id = byCat("lions-mane").id;
    s().deferDose(id, "breakfast", "19:00", "not-with-me");
    const list = buildSchedule(new Date(2026, 9, 6, 7, 0, 0));
    const today = list.filter((n) => (n.extra as { date: string }).date === TODAY);
    // Breakfast (Lion's Mane + theanine) minus the deferred one, so theanine only.
    const breakfast = today.find((n) => n.title.startsWith("First meal"));
    expect(breakfast?.body).toBe("L-Theanine 200mg");
    expect(today.some((n) => n.title === "Catch-up · Lion's Mane")).toBe(true);
    const bed = today.find((n) => n.title.startsWith("Before bed"))!;
    expect((bed.schedule!.at as Date).getHours()).toBe(22);
  });

  it("waits for 'I'm up' in flexible-wake mode", () => {
    setup(["rhodiola"], { flexibleWake: true });
    const first = buildSchedule(new Date(2026, 9, 6, 6, 0, 0)).find(
      (n) => (n.extra as { date: string }).date === TODAY,
    )!;
    expect(first.title).toMatch(/^When you're up/);
    expect((first.schedule!.at as Date).getHours()).toBe(9);
    s().setDay(TODAY, { wokeAt: "06:30" });
    const after = buildSchedule(new Date(2026, 9, 6, 6, 0, 0)).find(
      (n) => (n.extra as { date: string }).date === TODAY,
    )!;
    expect(after.title).toMatch(/^On waking/);
  });

  it("is empty when reminders are off", () => {
    s().setNotifications(false);
    expect(buildSchedule()).toEqual([]);
  });
});

describe("backups and migration", () => {
  it("upgrades v2 data and keeps your old window times", () => {
    const data = normalizeData({
      profile: {
        displayName: "x",
        slotTimes: {
          wake: "06:00",
          breakfast: "06:30",
          lunch: "12:00",
          afternoon: "15:00",
          dinner: "18:00",
          bed: "21:00",
        },
      } as never,
      stack: [{ ...byCat("lions-mane"), doseHistory: undefined as never }],
    });
    expect(data.stack[0]!.doseHistory).toHaveLength(1);
    expect(data.profile.rhythm.wake).toBe("06:00");
    expect(data.profile.slotTimes.bed).toBe("21:00");
    expect(data.days).toEqual([]);
  });

  it("round-trips through importData", () => {
    const snapshot = JSON.parse(JSON.stringify({ state: s() }));
    s().resetAll();
    expect(s().importData(snapshot)).toBe(true);
    expect(s().stack).toHaveLength(3);
    expect(s().importData({ nope: true })).toBe(false);
  });
});

describe("products and pills", () => {
  const product = (id: string) => {
    const p = PRODUCT_BY_ID[id]!;
    return {
      id: p.id,
      brand: p.brand,
      name: p.name,
      form: p.form,
      perUnit: p.perUnit,
      dosePerUnit: p.dosePerUnit,
    };
  };

  it("doses in pills and shows every ingredient", () => {
    s().resetAll();
    s().completeOnboarding({
      displayName: "Shawn",
      why: "",
      goals: ["focus", "sleep"],
      rhythm: rhythm(),
      habits: defaultHabits(),
      notifications: false,
      items: [
        {
          catalogId: "omega-3",
          product: product("cgn-omega3-premium"),
          units: 2,
          slots: ["dinner"],
          servingsPerContainer: 100,
        },
      ],
    });
    const omega = byCat("omega-3");
    expect(omega.amount).toBe(600);
    expect(omega.servingsPerDose).toBe(2);
    expect(contentsLabel(omega.product!.perUnit, 2, omega.product!.form)).toBe(
      "2 softgels = 360 mg EPA + 240 mg DHA",
    );
    s().logDose(omega.id, "dinner", "taken");
    expect(byCat("omega-3").servingsRemaining).toBe(98);
  });

  it("steps up a whole pill at a time, within the daily ceiling", () => {
    s().resetAll();
    s().completeOnboarding({
      displayName: "Shawn",
      why: "",
      goals: [],
      rhythm: rhythm(),
      habits: defaultHabits(),
      notifications: false,
      items: [
        {
          catalogId: "lions-mane",
          product: product("cgn-lions-mane-600"),
          units: 1,
          slots: ["breakfast"],
        },
        {
          catalogId: "l-theanine",
          product: product("doctors-best-theanine-150"),
          units: 1,
          slots: ["breakfast"],
        },
      ],
    });
    expect(nextStep(byCat("lions-mane"), 1)).toBe(1200);
    // 2 × 150 = 300 mg in one dose is over the ~250 mg per-dose cap: a 200 mg capsule is the step.
    expect(nextStep(byCat("l-theanine"), 1)).toBeNull();
    s().saveItem(byCat("l-theanine").id, { servingsPerDose: 2 });
    expect(byCat("l-theanine").amount).toBe(300);
    expect(nextStep(byCat("l-theanine"), 1)).toBeNull(); // 450 mg > 400 mg ceiling
  });

  it("matches iHerb products by id or brand and strength", () => {
    expect(matchProduct({ iherbId: 12959 })?.id).toBe("doctors-best-theanine-150");
    expect(matchProduct({ catalogId: "melatonin", brand: "NOW Foods", amount: 3 })?.id).toBe(
      "now-melatonin-3",
    );
  });
});

describe("your real setup: Sept 1 start, backfilled", () => {
  const product = (id: string) => {
    const p = PRODUCT_BY_ID[id]!;
    return {
      id: p.id,
      brand: p.brand,
      name: p.name,
      form: p.form,
      perUnit: p.perUnit,
      dosePerUnit: p.dosePerUnit,
    };
  };
  beforeEach(() => {
    vi.setSystemTime(new Date(2026, 9, 7, 12, 0, 0));
    s().resetAll();
    s().completeOnboarding({
      displayName: "Shawn",
      why: "Sharper focus, better sleep",
      goals: ["focus", "sleep"],
      rhythm: rhythm(),
      habits: defaultHabits(),
      notifications: false,
      items: [
        {
          catalogId: "lions-mane",
          product: product("cgn-lions-mane-600"),
          units: 1,
          slots: ["breakfast"],
          startedAt: "2026-09-01",
          backfill: "most",
          servingsPerContainer: 90,
        },
        {
          catalogId: "l-theanine",
          product: product("doctors-best-theanine-150"),
          units: 1,
          slots: ["breakfast"],
          startedAt: "2026-09-01",
          backfill: "most",
          servingsPerContainer: 90,
        },
        {
          catalogId: "melatonin",
          product: product("now-melatonin-3"),
          units: 1,
          slots: ["bed"],
          startedAt: "2026-09-01",
          backfill: "most",
          servingsPerContainer: 60,
        },
        {
          catalogId: "omega-3",
          product: product("cgn-omega3-premium"),
          units: 2,
          slots: ["dinner"],
          planned: true,
          servingsPerContainer: 100,
        },
      ],
    });
  });

  it("rebuilds history and joins on Sept 1", () => {
    expect(s().profile.joinedAt).toBe("2026-09-01");
    expect(s().logs.filter((l) => l.backfill && l.status === "taken").length).toBeGreaterThan(80);
    expect(s().profile.badges).toContain("history");
  });

  it("puts the owned omega first and lets you raise Lion's Mane after a check-in", () => {
    const today = "2026-10-07";
    const st = { ...s(), today };
    let a = advise(st);
    expect(a.planned.map((i) => i.name)).toEqual(["Omega-3 (EPA/DHA)"]);
    expect(a.slotOpen).toBe(true);
    expect(
      a.reconsider.some((r) => r.item.catalogId === "melatonin" && r.action === "switch"),
    ).toBe(true);
    s().logEffect(byCat("lions-mane").id, 1, { area: "focus" });
    a = advise({ ...s(), today });
    expect(a.increases.find((x) => x.item.catalogId === "lions-mane")?.to).toBe(1200);
    expect(a.ideas[0]?.catalogId).toBeDefined();
  });

  it("asks area questions and schedules safety checks", () => {
    expect(nextAsk(byCat("lions-mane"), s().effects).area).toBe("focus");
    expect(safetyDue(byCat("melatonin"), s().checks, "2026-10-07")).toBe(true);
    s().logSafety(byCat("melatonin").id, []);
    expect(safetyDue(byCat("melatonin"), s().checks, "2026-10-07")).toBe(false);
  });

  it("compares wearable data before and after", () => {
    const body = [];
    for (let i = -14; i < 36; i++) {
      body.push({
        date: addDays("2026-09-01", i),
        sleepHours: i < 0 ? 6.2 : 7.1,
        source: "manual" as const,
      });
    }
    const d = beforeAfter(byCat("melatonin"), body, "2026-10-07");
    expect(d[0]).toMatchObject({ metric: "sleepHours", before: 6.2, after: 7.1, better: true });
    expect(backfillLogs(byCat("melatonin"), "2026-09-01", "2026-09-08", "every")).toHaveLength(7);
  });
});

describe("v3.1: whole pills, one decision a day, skips vs sleep", () => {
  const v2Item = (catalogId: string, amount: number, slots: string[] = ["breakfast"]) => {
    setup([catalogId]);
    const item = byCat(catalogId);
    s().updateItem(item.id, {
      amount,
      slots: slots as never,
      startedAt: "2026-09-01",
      doseHistory: [{ date: "2026-09-01", amount, unit: "mg" }],
      product: undefined,
      servingLabel: undefined,
      servingsPerDose: 1,
    });
    return byCat(catalogId);
  };

  it("steps by whole capsules, not guide numbers", () => {
    expect(nextStep(v2Item("magnesium", 100), 1)).toBe(200);
    expect(nextStep(v2Item("lions-mane", 600), 1)).toBe(1200);
  });

  it("reads the strength from a typed label", () => {
    const item = v2Item("lions-mane", 1000);
    s().updateItem(item.id, { servingLabel: "1 capsule= 500 mg" });
    expect(nextStep(byCat("lions-mane"), 1)).toBe(1500);
    expect(nextStep(byCat("lions-mane"), -1)).toBe(500);
  });

  it("suggests a different capsule when another pill would cross a limit", () => {
    const item = v2Item("l-theanine", 150, ["breakfast", "afternoon"]);
    s().logEffect(item.id, 1, { date: "2026-10-01" });
    const j = journeyFor({ item: byCat("l-theanine"), logs: s().logs, effects: s().effects, decisions: [], today: TODAY });
    expect(j.recommendation).toMatchObject({ kind: "step-up", to: 200 });
    expect(j.recommendation.swap?.product.brand).toBe("NOW Foods");
  });

  it("stays put at the top dose when no bottle makes a safe step", () => {
    const item = v2Item("l-theanine", 200, ["breakfast", "afternoon"]);
    s().logEffect(item.id, 1, { date: "2026-10-01" });
    const j = journeyFor({ item: byCat("l-theanine"), logs: s().logs, effects: s().effects, decisions: [], today: TODAY });
    expect(j.recommendation.title).toBe("At the usual top dose");
  });

  it("flags bottles whose single pill is over the limit", async () => {
    const { pillTooStrong } = await import("@/lib/knowledge");
    expect(pillTooStrong("vitamin-d", 5000)).toMatch(/more than the usual daily maximum/);
    expect(pillTooStrong("vitamin-d", 1000)).toBeNull();
  });

  it("fixes past days and marks a trip as away, without farming XP", () => {
    const item = v2Item("lions-mane", 600);
    const left = byCat("lions-mane").servingsRemaining;
    s().setDoseRecord(item.id, "breakfast", "2026-10-01", "taken");
    expect(byCat("lions-mane").servingsRemaining).toBe(left - 1);
    const xp = totalXp(s(), TODAY);
    s().setDoseRecord(item.id, "breakfast", "2026-10-02", "taken");
    expect(totalXp(s(), TODAY) - xp).toBe(2); // history XP only
    const n = s().markAway([item.id], "2026-10-01", "2026-10-03");
    expect(n).toBe(3);
    expect(s().logs.filter((l) => l.status === "skipped" && l.reason === "not-with-me")).toHaveLength(3);
    expect(byCat("lions-mane").servingsRemaining).toBe(left);
  });

  it("two dose changes on one day are one decision and one step", () => {
    const item = v2Item("lions-mane", 600);
    s().decide(item.id, "step-up", { to: 1000 });
    s().decide(item.id, "step-up", { to: 1200 });
    const after = byCat("lions-mane");
    expect(s().decisions).toHaveLength(1);
    expect(s().decisions[0]).toMatchObject({ from: 600, to: 1200 });
    expect(after.doseHistory.map((d) => d.amount)).toEqual([600, 1200]);
    expect(after.servingsPerDose).toBe(2);
    const j = journeyFor({ item: after, logs: s().logs, effects: s().effects, decisions: s().decisions, today: TODAY });
    expect(j.changedToday).toBe(true);
    expect(j.recommendation.title).not.toMatch(/early/i);
  });

  it("changing back the same day removes the change", () => {
    const item = v2Item("lions-mane", 600);
    s().changeDose(item.id, 1200);
    s().changeDose(item.id, 600);
    expect(byCat("lions-mane").doseHistory).toHaveLength(1);
  });

  it("keep holds the review and re-tapping it earns no XP", () => {
    const item = v2Item("l-theanine", 150);
    s().logEffect(item.id, 1, { date: "2026-10-01" });
    const before = totalXp(s(), TODAY);
    s().decide(item.id, "keep");
    const once = totalXp(s(), TODAY);
    s().decide(item.id, "keep");
    expect(totalXp(s(), TODAY)).toBe(once);
    expect(once - before).toBe(40);
    const j = journeyFor({ item: byCat("l-theanine"), logs: s().logs, effects: s().effects, decisions: s().decisions, today: TODAY });
    expect(j.phase).toBe("holding");
    expect(j.recommendation.kind).toBe("keep");
    expect(advise({ ...s(), today: TODAY }).increases).toHaveLength(0);
  });

  it("links rough nights to missed doses", async () => {
    const { dayGrid, skipImpact } = await import("@/lib/insights");
    const item = v2Item("melatonin", 3, ["bed"]);
    const body = [];
    for (let i = 1; i <= 20; i++) {
      const date = addDays("2026-09-15", i - 1);
      const missed = i % 4 === 0;
      if (!missed) s().logDose(item.id, "bed", "taken", date);
      body.push({ date: addDays(date, 1), sleepHours: missed ? 5.6 : 7.4, source: "fitbit" as const });
    }
    const impact = skipImpact(byCat("melatonin"), s().logs, body, TODAY);
    expect(impact[0]).toMatchObject({ metric: "sleepHours", taken: 7.4, missed: 5.6, helps: true });
    const g = dayGrid({ stack: s().stack, logs: s().logs, body, today: "2026-10-05" });
    expect(g.note).toMatch(/missed Melatonin/);
  });
});

describe("v3.3: dose changes start on the right day", () => {
  it("a step-up decided after today's dose starts tomorrow", () => {
    setup(["lions-mane"]);
    const id = byCat("lions-mane").id;
    s().updateItem(id, { amount: 600, servingsPerDose: 1, startedAt: "2026-09-01", doseHistory: [{ date: "2026-09-01", amount: 600, unit: "mg" }] });
    s().logDose(id, byCat("lions-mane").slots[0]!, "taken", TODAY);
    s().decide(id, "step-up", { to: 1200 });
    const item = byCat("lions-mane");
    expect(item.amount).toBe(600);
    expect(item.pendingDose).toMatchObject({ date: "2026-10-07", amount: 1200, units: 2 });
    expect(item.doseHistory).toHaveLength(1);
    s().applyPendingDoses("2026-10-07");
    const after = byCat("lions-mane");
    expect(after.amount).toBe(1200);
    expect(after.pendingDose).toBeUndefined();
    expect(after.doseHistory.at(-1)).toMatchObject({ date: "2026-10-07", amount: 1200 });
  });

  it("starts today when nothing was taken yet, and can be cancelled", () => {
    setup(["lions-mane"]);
    const id = byCat("lions-mane").id;
    s().updateItem(id, { amount: 600, startedAt: "2026-09-01", doseHistory: [{ date: "2026-09-01", amount: 600, unit: "mg" }] });
    s().decide(id, "step-up", { to: 1200 });
    expect(byCat("lions-mane").amount).toBe(1200);
    s().decide(id, "lower", { to: 600, startOn: "2026-10-07" });
    expect(byCat("lions-mane").pendingDose?.amount).toBe(600);
    s().cancelPendingDose(id);
    expect(byCat("lions-mane").pendingDose).toBeUndefined();
  });
});

describe("v3.4: real mornings and evening check-ins", () => {
  it("a first log on a flexible morning means you're up by then", () => {
    setup(["lions-mane"], { flexibleWake: true });
    vi.setSystemTime(new Date(2026, 9, 6, 11, 32, 0));
    s().logDose(byCat("lions-mane").id, byCat("lions-mane").slots[0]!, "taken", TODAY);
    expect(s().days.find((d) => d.date === TODAY)).toMatchObject({
      wokeAt: "11:32",
      wakeSource: "inferred",
    });
  });

  it("doesn't guess a wake time when your mornings are fixed", () => {
    setup(["lions-mane"]);
    s().logDose(byCat("lions-mane").id, byCat("lions-mane").slots[0]!, "taken", TODAY);
    expect(s().days.find((d) => d.date === TODAY)?.wokeAt).toBeUndefined();
  });

  it("reminds you to rate the day an hour before bed, until you do", () => {
    const list = buildSchedule(new Date(2026, 9, 6, 7, 0, 0));
    const feel = list.filter((n) => (n.extra as { kind?: string }).kind === "feel");
    expect(feel).toHaveLength(7);
    expect((feel[0]!.schedule!.at as Date).getHours()).toBe(22);
    s().logBody({ date: TODAY, energy: 4, mood: 4, focus: 3, notes: "Good day", source: "manual" });
    expect(
      buildSchedule(new Date(2026, 9, 6, 7, 0, 0)).filter(
        (n) => (n.extra as { kind?: string }).kind === "feel",
      ),
    ).toHaveLength(6);
    s().setProfile({ feelReminder: { enabled: false } });
    expect(
      buildSchedule(new Date(2026, 9, 6, 7, 0, 0)).some(
        (n) => (n.extra as { kind?: string }).kind === "feel",
      ),
    ).toBe(false);
  });
});

describe("v3.5: coffee that fits", () => {
  const theanineTwice = () => {
    setup(["l-theanine", "melatonin"]);
    const id = byCat("l-theanine").id;
    s().updateItem(id, { slots: ["breakfast", "afternoon"] });
    vi.setSystemTime(new Date(2026, 9, 6, 10, 54, 0));
    s().logDose(id, "breakfast", "taken", TODAY);
    return id;
  };
  const tips = (cup: string) =>
    coffeeTips({ stack: s().stack, logs: s().logs, profile: s().profile, times: s().profile.slotTimes, date: TODAY, cup });

  it("doesn't pair an afternoon dose with this morning's coffee", () => {
    theanineTwice();
    s().setDay(TODAY, { coffeeAt: ["09:54"] });
    const flags = doseFlags({
      item: byCat("l-theanine"),
      slot: "afternoon",
      times: s().profile.slotTimes,
      profile: s().profile,
      stack: s().stack,
      day: s().days.find((d) => d.date === TODAY),
    });
    const coffee = flags.find((f) => f.icon === "coffee")!;
    expect(coffee.text).toBe("Pairs well with coffee: take it with your next one.");
  });

  it("a 3:40 pm coffee is a good moment for the afternoon theanine", () => {
    theanineTwice();
    const t = tips("15:40");
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ kind: "take-now", slot: "afternoon" });
  });

  it("not right after the morning dose", () => {
    theanineTwice();
    expect(tips("11:30")).toHaveLength(0);
  });
});

describe("v3.5: bottles, orders and short links", () => {
  it("switching to a same-strength bottle keeps the timeline", () => {
    setup(["l-theanine"]);
    const id = byCat("l-theanine").id;
    s().updateItem(id, { amount: 200, startedAt: "2026-09-01", doseHistory: [{ date: "2026-09-01", amount: 200, unit: "mg" }] });
    const now = PRODUCT_BY_ID["now-theanine-200"] ?? Object.values(PRODUCT_BY_ID).find((p) => p.catalogId === "l-theanine" && p.dosePerUnit === 200)!;
    s().switchBottle(id, { product: { ...now }, units: 1, bottle: 120, startOn: TODAY });
    const item = byCat("l-theanine");
    expect(item.product?.brand).toBe(now.brand);
    expect(item.doseHistory).toHaveLength(1);
    expect(item.servingsRemaining).toBe(120);
  });

  it("ordered and interested items stay off Today until they arrive", () => {
    setup(["lions-mane"]);
    s().addItem({ catalogId: "magnesium", stage: "ordered", arrivesOn: "2026-10-12" });
    const mg = byCat("magnesium");
    expect(mg).toMatchObject({ planned: true, stage: "ordered", arrivesOn: "2026-10-12" });
    expect(advise({ ...s(), today: TODAY }).planned.some((i) => i.id === mg.id)).toBe(false);
    s().setStage(mg.id, null);
    expect(byCat("magnesium").stage).toBeUndefined();
    expect(advise({ ...s(), today: TODAY }).planned.some((i) => i.id === mg.id)).toBe(true);
  });

  it("recognises iHerb app share links that need resolving", async () => {
    const { isShortLink } = await import("@/lib/iherb");
    expect(isShortLink("https://iherb.co/UzUjrEP7?utm_medium=appshare")).toBe(true);
    expect(isShortLink("https://www.iherb.com/pr/now-foods-melatonin-3-mg/10930")).toBe(false);
  });

  it("warns when you add a second bottle of something you take", async () => {
    const { fitCheck } = await import("@/lib/advisor");
    setup(["l-theanine"]);
    const notes = fitCheck("l-theanine", { stack: s().stack, today: TODAY });
    expect(notes[0]?.tone).toBe("warn");
  });
});
