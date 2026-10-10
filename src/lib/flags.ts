import { CATALOG_BY_ID } from "./catalog";
import { profileFor } from "./knowledge";
import { activeStack, dayMinutes } from "./protocol";
import {
  SLOTS,
  type DayContext,
  type Profile,
  type SlotId,
  type SlotTimes,
  type StackItem,
} from "./types";

const SLOT_LABEL = Object.fromEntries(SLOTS.map((s) => [s.id, s.label.toLowerCase()])) as Record<
  SlotId,
  string
>;
import { formatClock, formatHHMM } from "./utils";

export type Flag = {
  tone: "warn" | "good" | "info";
  icon: "food" | "coffee" | "alcohol" | "moon" | "sun" | "split";
  text: string;
};

/**
 * Habit and timing checks for one dose in one window, using your rhythm, your usual
 * habits, and what you logged today (coffee, a drink). Warnings come first.
 */
export function doseFlags(input: {
  item: StackItem;
  slot: SlotId;
  times: SlotTimes;
  profile: Pick<Profile, "rhythm" | "habits">;
  stack: StackItem[];
  day?: DayContext;
}): Flag[] {
  const { item, slot, times, profile, stack, day } = input;
  const p = profileFor(item);
  const wake = profile.rhythm.wake;
  const at = dayMinutes(times[slot], wake);
  const bed = dayMinutes(profile.rhythm.bed, wake);
  const flags: Flag[] = [];
  const mealSlot = slot === "breakfast" || slot === "lunch" || slot === "dinner";

  const foodOk = item.foodOk ?? p.timing.food;
  const fineEmpty = foodOk.includes("empty") || foodOk.includes("any");
  if (p.timing.avoid.includes(slot)) {
    flags.push({
      tone: "warn",
      icon: slot === "bed" || slot === "dinner" ? "moon" : "sun",
      text: `Not a good window for ${item.name}. Better: ${p.timing.best.map((s) => SLOT_LABEL[s]).join(" or ")}.`,
    });
  }

  for (const rule of p.rules) {
    switch (rule.kind) {
      case "needs-food":
      case "needs-fat":
        if (!mealSlot && rule.kind === "needs-food" && fineEmpty) {
          flags.push({
            tone: "info",
            icon: "food",
            text: "Fine without food; take it with a meal if your stomach is sensitive.",
          });
        } else if (!mealSlot) {
          flags.push({
            tone: "warn",
            icon: "food",
            text: `${rule.kind === "needs-fat" ? "Needs a meal with fat" : "Needs food"}, and this window has no meal. Move it to a meal window.`,
          });
        } else {
          flags.push({ tone: "info", icon: "food", text: rule.text });
        }
        break;
      case "empty-stomach": {
        const ate = (day?.mealsAt ?? [])
          .map((m) => dayMinutes(m, wake))
          .filter((m) => m <= at && at - m < 120)
          .pop();
        if (!mealSlot && ate !== undefined) {
          flags.push({
            tone: "warn",
            icon: "food",
            text: `You ate at ${formatClock(formatHHMM(ate))}. Best ~2 h after a meal: from ${formatClock(formatHHMM(ate + 120))}.`,
          });
          break;
        }
        flags.push(
          mealSlot
            ? {
                tone: "warn",
                icon: "food",
                text: "Works best on an empty stomach, not with a meal.",
              }
            : { tone: "info", icon: "food", text: rule.text },
        );
        break;
      }
      case "stimulating":
        if (at > bed - 8 * 60) {
          flags.push({
            tone: "warn",
            icon: "sun",
            text: `Stimulating — at ${formatClock(times[slot])} it may cost you sleep.`,
          });
        }
        break;
      case "drowsy":
        if (at < bed - 5 * 60 && slot !== "dinner" && slot !== "bed") {
          flags.push({
            tone: "warn",
            icon: "moon",
            text: "Can make you drowsy — an evening window suits it better.",
          });
        } else if (
          item.catalogId === "melatonin" ||
          item.catalogId === "glycine" ||
          item.catalogId === "apigenin"
        ) {
          flags.push({
            tone: "info",
            icon: "moon",
            text: "Dim the lights and screens after taking it.",
          });
        }
        break;
      case "avoid-caffeine": {
        const hours = rule.hours ?? 1;
        const cups = [...(day?.coffeeAt ?? [])];
        if (profile.habits.coffee && !cups.length) cups.push(profile.habits.coffeeTime);
        const clash = cups.find((c) => Math.abs(dayMinutes(c, wake) - at) < hours * 60);
        flags.push(
          clash
            ? {
                tone: "warn",
                icon: "coffee",
                text: `Coffee at ${formatClock(clash)} is within ${hours} h — it blocks absorption. Space them out.`,
              }
            : { tone: "info", icon: "coffee", text: rule.text },
        );
        break;
      }
      case "pairs-caffeine": {
        // Only name a coffee that's actually near this window.
        const cups = [...(day?.coffeeAt ?? [])];
        if (profile.habits.coffee && !cups.length) cups.push(profile.habits.coffeeTime);
        const near = cups
          .map((c) => ({ c, d: Math.abs(dayMinutes(c, wake) - at) }))
          .filter((x) => x.d <= 60)
          .sort((a, b) => a.d - b.d)[0];
        flags.push(
          near
            ? {
                tone: "good",
                icon: "coffee",
                text: `Take it with your ${formatClock(near.c)} coffee: it smooths the jitters.`,
              }
            : {
                tone: "info",
                icon: "coffee",
                text: "Pairs well with coffee: take it with your next one.",
              },
        );
        break;
      }
      case "avoid-alcohol": {
        const hours = rule.hours ?? 3;
        const drink = (day?.alcoholAt ?? []).find((d) => {
          const m = dayMinutes(d, wake);
          return m <= at + 30 && at - m < hours * 60;
        });
        if (drink) {
          flags.push({
            tone: "warn",
            icon: "alcohol",
            text: `You had a drink at ${formatClock(drink)}. ${item.catalogId === "melatonin" ? "Consider skipping tonight" : "Keep it a few hours apart"} — ${rule.text.split("—")[1]?.trim() ?? "alcohol interferes"}.`,
          });
        } else if (profile.habits.alcohol !== "never") {
          flags.push({
            tone: "info",
            icon: "alcohol",
            text: `No alcohol within ${hours} h of taking it.`,
          });
        }
        break;
      }
      case "separate": {
        const others = activeStack(stack).filter(
          (o) => o.id !== item.id && o.catalogId && rule.with?.includes(o.catalogId),
        );
        for (const other of others) {
          const close = other.slots.some(
            (s) => Math.abs(dayMinutes(times[s], wake) - at) < (rule.hours ?? 2) * 60,
          );
          if (close) {
            flags.push({
              tone: "warn",
              icon: "split",
              text: `Too close to ${other.name} — they compete for absorption. Keep them ${rule.hours ?? 2} h apart.`,
            });
          }
        }
        break;
      }
    }
  }

  // The guide's "avoid with" list, for anything not covered by a rule above.
  const cat = item.catalogId ? CATALOG_BY_ID[item.catalogId] : undefined;
  for (const otherId of cat?.avoidWith ?? []) {
    if (p.rules.some((r) => r.kind === "separate" && r.with?.includes(otherId))) continue;
    const other = activeStack(stack).find((o) => o.catalogId === otherId && o.slots.includes(slot));
    if (other) {
      flags.push({
        tone: "warn",
        icon: "split",
        text: `Avoid taking with ${other.name} in the same window.`,
      });
    }
  }

  const order = { warn: 0, good: 1, info: 2 } as const;
  return flags.sort((a, b) => order[a.tone] - order[b.tone]);
}

/** Every warning across your stack, for the habit check on Stack and Journey. */
export function stackWarnings(input: {
  stack: StackItem[];
  times: SlotTimes;
  profile: Pick<Profile, "rhythm" | "habits">;
}) {
  const out: { item: StackItem; slot: SlotId; flag: Flag }[] = [];
  for (const item of activeStack(input.stack)) {
    for (const slot of item.slots) {
      for (const flag of doseFlags({ ...input, item, slot })) {
        if (flag.tone === "warn") out.push({ item, slot, flag });
      }
    }
  }
  return out;
}

export type CoffeeTip = {
  item: StackItem;
  slot: SlotId;
  kind: "take-now" | "wait";
  text: string;
};

/**
 * You just had a coffee at `cup`. Which open doses pair with it and are fine to take now
 * (right time of day, not too close to bed if stimulating, ≥ 3 h since your last dose of the
 * same supplement)? And which upcoming doses should wait because caffeine gets in the way?
 */
export function coffeeTips(input: {
  stack: StackItem[];
  logs: { itemId: string; slot: SlotId; date: string; status: string; at: string }[];
  profile: Pick<Profile, "rhythm" | "habits">;
  times: SlotTimes;
  date: string;
  cup: string;
}): CoffeeTip[] {
  const { stack, logs, profile, times, date, cup } = input;
  const wake = profile.rhythm.wake;
  const cupM = dayMinutes(cup, wake);
  const bed = dayMinutes(profile.rhythm.bed, wake);
  const today = logs.filter((l) => l.date === date);
  const tips: CoffeeTip[] = [];
  const minuteOf = (iso: string) => {
    const d = new Date(iso);
    return dayMinutes(
      `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
      wake,
    );
  };
  for (const item of activeStack(stack)) {
    const p = profileFor(item);
    const done = (slot: SlotId) =>
      today.some((l) => l.itemId === item.id && l.slot === slot && l.status !== "deferred");
    const open = item.slots
      .filter((s) => !done(s))
      .sort((a, b) => dayMinutes(times[a], wake) - dayMinutes(times[b], wake));
    if (!open.length) continue;

    if (p.rules.some((r) => r.kind === "pairs-caffeine")) {
      const slot = open[0]!;
      const lastTaken = today
        .filter((l) => l.itemId === item.id && l.status === "taken")
        .map((l) => minuteOf(l.at))
        .sort((a, b) => b - a)[0];
      const stimulating = p.rules.some((r) => r.kind === "stimulating");
      const tooLate = stimulating && cupM > bed - 8 * 60;
      const tooSoon = lastTaken !== undefined && cupM - lastTaken < 180;
      const badWindow = p.timing.avoid.some(
        (s) => Math.abs(dayMinutes(times[s], wake) - cupM) < 60,
      );
      if (!tooLate && !tooSoon && !badWindow) {
        tips.push({
          item,
          slot,
          kind: "take-now",
          text: `Good moment for ${item.name}: it pairs with coffee and smooths the jitters.`,
        });
      }
    }

    const avoid = p.rules.find((r) => r.kind === "avoid-caffeine");
    if (avoid) {
      const hours = avoid.hours ?? 1;
      for (const slot of open) {
        const m = dayMinutes(times[slot], wake);
        if (m >= cupM - 30 && m - cupM < hours * 60) {
          tips.push({
            item,
            slot,
            kind: "wait",
            text: `Wait until ${formatClock(formatHHMM((cupM + hours * 60) % 1440))} for ${item.name}: coffee gets in the way.`,
          });
        }
      }
    }
  }
  return tips;
}
