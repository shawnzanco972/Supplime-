import { profileFor } from "./knowledge";
import { timingFor } from "./timing";
import { dayMinutes } from "./protocol";
import {
  SLOTS,
  type MissReason,
  type Rhythm,
  type SlotId,
  type SlotTimes,
  type StackItem,
} from "./types";
import { formatClock, formatHHMM } from "./utils";

export type MissedAdvice = {
  /** catch-up: take it later today. skip: leave it today. optional: only if you want the effect now. */
  action: "catch-up" | "skip" | "optional";
  /** When to take it (HH:MM) for catch-up / optional. */
  suggestAt?: string;
  /** Latest sensible time today (HH:MM). */
  latest?: string;
  title: string;
  message: string;
};

const NO_DOUBLE = "Don't double up tomorrow — just carry on as normal.";

function needsFood(item: StackItem) {
  const rules = profileFor(item).rules;
  return (
    item.foodTiming === "with" ||
    item.foodTiming === "after" ||
    rules.some((r) => r.kind === "needs-food" || r.kind === "needs-fat")
  );
}

/**
 * You can't (or didn't) take a dose in its window. Should you still take it today,
 * and when? The answer depends on how the supplement works:
 * slow builders (Lion's Mane, D3) are happy with a late dose; same-day ones
 * (theanine) have nothing to catch up; sleep aids only make sense at bedtime; and
 * stimulating ones must not drift into the evening.
 */
export function missedAdvice(input: {
  item: StackItem;
  slot: SlotId;
  reason: MissReason;
  /** Minutes into the logical day (past midnight = 24:xx). */
  now: number;
  times: SlotTimes;
  rhythm: Rhythm;
}): MissedAdvice {
  const { item, slot, reason, now, times, rhythm } = input;
  const p = profileFor(item);
  const wake = rhythm.wake;
  const bed = dayMinutes(rhythm.bed, wake);
  const home = dayMinutes(rhythm.home, wake);
  const earliest = reason === "not-with-me" ? Math.max(now, home) : now;
  const food = needsFood(item);
  const meals = (["breakfast", "lunch", "dinner"] as const)
    .map((s) => ({ slot: s, at: dayMinutes(times[s], wake) }))
    .sort((a, b) => a.at - b.at);
  const at = (m: number) => formatHHMM(m);
  const clock = (m: number) => formatClock(at(m));

  if (p.missed === "optional") {
    const latest = bed - 60;
    return {
      action: "optional",
      suggestAt: earliest <= latest ? at(earliest) : undefined,
      latest: at(latest),
      title: "Nothing to catch up",
      message: `${item.name} works within ${p.minutes ? `${p.minutes.min}–${p.minutes.max} minutes` : "the day"}, so a missed dose doesn't set you back. Take it later only if you want the effect then; otherwise skip today.`,
    };
  }

  if (p.missed === "bedtime-only") {
    const latest = bed + 60;
    if (slot === "bed" && earliest <= latest) {
      return {
        action: "catch-up",
        suggestAt: at(Math.max(earliest, bed - 45)),
        latest: at(latest),
        title: "Still fine tonight",
        message: `Take ${item.name} when you're winding down, as long as it's before ${clock(latest)} and you still have 7+ hours to sleep.`,
      };
    }
    return {
      action: "skip",
      title: "Skip it tonight",
      message:
        slot === "bed"
          ? `Too late for ${item.name} tonight: a late dose pushes the grogginess into tomorrow morning. ${NO_DOUBLE}`
          : `${item.name} only makes sense at bedtime. ${NO_DOUBLE}`,
    };
  }

  const t = timingFor(item);
  const slotAt = dayMinutes(times[slot], wake);
  // How late is still sensible, from the research per supplement.
  const lateLimit = slotAt + t.lateHours * 60;
  // Stimulating supplements must not drift into the evening.
  const bedLimit =
    p.missed === "morning-only"
      ? Math.min(dayMinutes(wake, wake) + 7 * 60, bed - (t.bedCutoffHours ?? 8) * 60)
      : t.bedCutoffHours
        ? bed - t.bedCutoffHours * 60
        : p.rules.some((r) => r.kind === "drowsy")
          ? bed
          : bed - 60;
  const latest = Math.min(lateLimit, bedLimit);

  if (earliest > latest) {
    const tooLate = lateLimit <= bedLimit;
    return {
      action: "skip",
      title: "Skip it today",
      message: tooLate
        ? `It's more than ${t.lateHours} h past its time. ${t.lateWhy} ${NO_DOUBLE}`
        : p.missed === "morning-only" || t.bedCutoffHours
          ? `${item.name} is stimulating; after ${clock(latest)} it can cost you sleep. ${NO_DOUBLE}`
          : `It's too late in your day for ${item.name}. ${p.kind === "cumulative" ? "One missed day doesn't undo your progress. " : ""}${NO_DOUBLE}`,
    };
  }

  // Taken more than once a day: a late dose mustn't crowd the next one.
  const order = SLOTS.map((x) => x.id);
  const nextSlot = item.slots
    .filter((x) => order.indexOf(x) > order.indexOf(slot))
    .sort((a, b) => dayMinutes(times[a], wake) - dayMinutes(times[b], wake))[0];
  if (nextSlot && t.minGapHours) {
    const nextAt = dayMinutes(times[nextSlot], wake);
    const gap = t.minGapHours * 60;
    if (nextAt - earliest < gap) {
      if (t.multiDose === "merge") {
        return {
          action: "catch-up",
          suggestAt: at(nextAt),
          latest: at(latest),
          title: "Take it with your next dose",
          message: `Your next ${item.name} is at ${clock(nextAt)}. ${t.lateWhy} Take both then.`,
        };
      }
      if (t.multiDose === "push-next") {
        return {
          action: "catch-up",
          suggestAt: at(earliest),
          latest: at(latest),
          title: "Take it now, push the next one",
          message: `Keep ${t.minGapHours} h between doses: take this one now and the next at ${clock(Math.min(earliest + gap, latest + gap))} instead of ${clock(nextAt)}.`,
        };
      }
      return {
        action: "skip",
        title: "Skip this one",
        message: `Your next ${item.name} is at ${clock(nextAt)}, less than ${t.minGapHours} h away. Skip this dose and take the next one as usual. ${NO_DOUBLE}`,
      };
    }
  }

  if (food) {
    const meal = meals.find((m) => m.at + 60 >= earliest && m.at <= latest);
    if (!meal) {
      return {
        action: "skip",
        title: "Skip it today",
        message: `${item.name} needs food and there's no meal left in your day. ${p.kind === "cumulative" ? "One missed day doesn't undo your progress. " : ""}${NO_DOUBLE}`,
      };
    }
    const when = Math.max(meal.at, earliest);
    return {
      action: "catch-up",
      suggestAt: at(when),
      latest: at(latest),
      title: "Catch up with food",
      message: `${p.kind === "cumulative" ? `${item.name} builds up over weeks, so a late dose today still counts. ` : ""}Take it with ${meal.at >= earliest ? `your ${labelFor(meal.slot)} (${clock(meal.at)})` : "food when you can"}${reason === "not-with-me" ? " once you're home" : ""}.`,
    };
  }

  return {
    action: "catch-up",
    suggestAt: at(earliest),
    latest: at(latest),
    title: reason === "not-with-me" ? "Take it when you're home" : "Take it now",
    message: `${p.kind === "cumulative" ? `${item.name} builds up over weeks, so a late dose today still counts. ` : ""}Anytime before ${clock(latest)} is fine.`,
  };
}

function labelFor(slot: "breakfast" | "lunch" | "dinner") {
  return slot === "breakfast" ? "first meal" : slot === "lunch" ? "second meal" : "last meal";
}
