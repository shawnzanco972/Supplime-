import { beforeEach, describe, expect, it, vi } from "vitest";
import { doseFlags } from "@/lib/flags";
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

  it("moves morning windows when you get up late", () => {
    const profile = { slotTimes: slotTimesFromRhythm(rhythm()), rhythm: rhythm() };
    const { times, shift } = effectiveSlotTimes(profile, [{ date: TODAY, wokeAt: "09:30" }], TODAY);
    expect(shift).toBe(150);
    expect(times.wake).toBe("09:30");
    expect(times.breakfast).toBe("10:30");
    expect(times.dinner).toBe("19:00");
    expect(times.bed).toBe(profile.slotTimes.bed);
  });
});

describe("knowledge: how long until it works", () => {
  it("knows each of your supplements' timeline", () => {
    const lm = profileFor(byCat("lions-mane"));
    expect([lm.firstSignsDay, lm.typicalDay, lm.minDaysBeforeIncrease, lm.evaluateDay]).toEqual([
      7, 21, 14, 56,
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
    expect(journey().next?.key).toBe("dose-review");
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
    expect(j.recommendation).toMatchObject({ kind: "lower", to: 0.5 });
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
    const profile = { rhythm: rhythm(), habits: defaultHabits() };
    const flags = doseFlags({
      item: byCat("lions-mane"),
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
    s().logDose(id, "breakfast", "taken");
    s().logEffect(id, 1);
    expect(totalXp(s(), TODAY)).toBe(10 + 15);
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
