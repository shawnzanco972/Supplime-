import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSchedule } from "@/lib/notifications";
import {
  currentStep,
  dayAdherence,
  daysAtDose,
  effectWindow,
  firstFelt,
  loggingConsistency,
  needsCheckIn,
} from "@/lib/stats";
import { normalizeData, useSupplime } from "@/lib/store";
import { addDays, todayKey } from "@/lib/utils";

const TODAY = "2026-10-06";

function reset() {
  useSupplime.getState().resetAll();
  useSupplime.getState().completeOnboarding({
    displayName: "Test",
    goals: [],
    catalogIds: ["lions-mane", "magnesium"],
    notifications: true,
  });
}

function lionsMane() {
  return useSupplime.getState().stack.find((s) => s.catalogId === "lions-mane")!;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 9, 6, 6, 0, 0));
  reset();
});

describe("dose steps", () => {
  it("restarts the review clock when the dose changes", () => {
    const { updateItem, changeDose } = useSupplime.getState();
    updateItem(lionsMane().id, { startedAt: addDays(TODAY, -20) });
    expect(daysAtDose(lionsMane(), TODAY)).toBe(21);
    expect(effectWindow(lionsMane(), TODAY).readyToIncrease).toBe(true);

    changeDose(lionsMane().id, 1500);
    const item = lionsMane();
    expect(item.amount).toBe(1500);
    expect(item.doseHistory.map((s) => s.amount)).toEqual([1000, 1500]);
    expect(daysAtDose(item, TODAY)).toBe(1);
    expect(effectWindow(item, TODAY).readyToIncrease).toBe(false);
    expect(effectWindow(item, TODAY).reviewOn).toBe(addDays(TODAY, 13));
    // Days on the supplement as a whole keep counting from the original start.
    expect(effectWindow(item, TODAY).elapsed).toBe(21);
  });

  it("treats a dose change on the start day as a correction", () => {
    useSupplime.getState().changeDose(lionsMane().id, 500);
    expect(lionsMane().doseHistory).toEqual([{ date: TODAY, amount: 500, unit: "mg" }]);
  });

  it("moves the first step when the start date is backdated", () => {
    useSupplime.getState().updateItem(lionsMane().id, { startedAt: "2026-09-01" });
    expect(currentStep(lionsMane()).date).toBe("2026-09-01");
  });
});

describe("effects", () => {
  it("records the first day an effect was felt", () => {
    const { updateItem, logEffect } = useSupplime.getState();
    updateItem(lionsMane().id, { startedAt: addDays(TODAY, -15) });
    logEffect(lionsMane().id, 1, undefined, addDays(TODAY, -3));
    logEffect(lionsMane().id, 2, undefined, TODAY);
    const felt = firstFelt(lionsMane(), useSupplime.getState().effects);
    expect(felt?.day).toBe(16);
    expect(useSupplime.getState().profile.badges).toContain("felt-it");
  });

  it("asks for a check-in near the onset window, not on day one", () => {
    const effects = useSupplime.getState().effects;
    expect(needsCheckIn(lionsMane(), effects, TODAY)).toBe(false);
    useSupplime.getState().updateItem(lionsMane().id, { startedAt: addDays(TODAY, -12) });
    expect(needsCheckIn(lionsMane(), effects, TODAY)).toBe(true);
  });
});

describe("adherence", () => {
  it("does not count items before they started", () => {
    const { stack } = useSupplime.getState();
    const yesterday = dayAdherence(stack, [], addDays(TODAY, -1));
    expect(yesterday.scheduled).toBe(0);
  });

  it("ignores days before you started logging when judging consistency", () => {
    const { updateItem, logDose } = useSupplime.getState();
    updateItem(lionsMane().id, { startedAt: addDays(TODAY, -30) });
    logDose(lionsMane().id, "breakfast", "taken", TODAY);
    const c = loggingConsistency(lionsMane(), useSupplime.getState().logs, TODAY);
    expect(c).toEqual({ span: 1, taken: 1, rate: 1 });
  });
});

describe("reminder schedule", () => {
  it("schedules every window for two weeks plus follow-up nudges", () => {
    const list = buildSchedule(new Date(2026, 9, 6, 6, 0, 0));
    // Lion's Mane: breakfast. Magnesium: dinner + bed. 3 windows × 14 days, each with a nudge.
    const doses = list.filter((n) => n.channelId === "supplime-reminders");
    expect(doses.filter((n) => !n.title.startsWith("Still open")).length).toBe(42);
    expect(doses.filter((n) => n.title.startsWith("Still open")).length).toBe(42);
    // Low-stock heads-up: magnesium (2/day from 60) crosses 10 days left in 20 days.
    const stock = list.filter((n) => n.channelId === "supplime-stock");
    expect(stock.map((n) => n.title)).toEqual([
      "Lion's Mane is running low",
      "Magnesium glycinate is running low",
    ]);
    expect((stock[1]!.schedule!.at as Date).getDate()).toBe(26);
    const first = list[0]!;
    expect(first.title).toMatch(/Breakfast/);
    // 10 minutes early by default: 08:00 - 10 = 07:50.
    expect((first.schedule!.at as Date).getHours()).toBe(7);
    expect((first.schedule!.at as Date).getMinutes()).toBe(50);
  });

  it("drops today's window once it is logged, and windows already past", () => {
    useSupplime.getState().logDose(lionsMane().id, "breakfast", "taken", TODAY);
    const list = buildSchedule(new Date(2026, 9, 6, 19, 15, 0));
    const today = list.filter((n) => (n.extra as { date: string }).date === TODAY);
    expect(today.map((n) => n.title)).toEqual([
      "Still open · Dinner",
      "Before bed · 9:30 pm",
      "Still open · Before bed",
    ]);
  });

  it("is empty when reminders are off", () => {
    useSupplime.getState().setNotifications(false);
    expect(buildSchedule()).toEqual([]);
  });
});

describe("backups", () => {
  it("fills missing fields from older data", () => {
    const data = normalizeData({
      profile: { displayName: "x" } as never,
      stack: [{ ...lionsMane(), doseHistory: undefined as never }],
    });
    expect(data.stack[0]!.doseHistory).toHaveLength(1);
    expect(data.effects).toEqual([]);
    expect(data.profile.nagMinutes).toBe(30);
  });

  it("round-trips through importData", () => {
    const snapshot = JSON.parse(JSON.stringify({ state: useSupplime.getState() }));
    useSupplime.getState().resetAll();
    expect(useSupplime.getState().importData(snapshot)).toBe(true);
    expect(useSupplime.getState().stack).toHaveLength(2);
    expect(useSupplime.getState().importData({ nope: true })).toBe(false);
  });
});

it("todayKey uses local time", () => {
  expect(todayKey()).toBe(TODAY);
});
