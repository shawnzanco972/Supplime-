import { activeStack } from "./protocol";
import type { BodyLog, DoseLog, StackItem } from "./types";
import { addDays } from "./utils";

/**
 * Consumption vs. your body signals. Sleep is filed under the morning you woke up,
 * so the night after day D is the body entry for D + 1.
 */

export type Cell = "taken" | "partial" | "missed" | "away" | "open" | "none";

export type DayGrid = {
  dates: string[];
  rows: { item: StackItem; cells: Cell[] }[];
  /** Sleep the night after each day (hours), if your wearable has it. */
  sleep: (number | undefined)[];
  /** Nights noticeably worse than your usual. */
  poorSleep: boolean[];
  /** A short line linking bad nights to missed doses, if there's a pattern. */
  note: string | null;
};

export function cellFor(item: StackItem, logs: DoseLog[], date: string, today: string): Cell {
  if (date < item.startedAt || item.planned) return "none";
  if (item.archived && date > item.archived.date) return "none";
  const planned = Math.max(1, item.slots.length);
  const taken = logs.filter(
    (l) => l.itemId === item.id && l.date === date && l.status === "taken",
  ).length;
  if (taken >= planned) return "taken";
  if (taken > 0) return "partial";
  if (logs.some((l) => l.itemId === item.id && l.date === date && l.away)) return "away";
  return date >= today ? "open" : "missed";
}

const median = (a: number[]) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? s[Math.floor(s.length / 2)]! : 0;
};

export function dayGrid(input: {
  stack: StackItem[];
  logs: DoseLog[];
  body: BodyLog[];
  today: string;
  days?: number;
}): DayGrid {
  const { stack, logs, body, today } = input;
  const n = input.days ?? 14;
  const dates = Array.from({ length: n }, (_, i) => addDays(today, i - n + 1));
  const items = activeStack(stack).filter((i) => i.startedAt <= today);
  const rows = items.map((item) => ({
    item,
    cells: dates.map((d) => cellFor(item, logs, d, today)),
  }));
  const byDate = new Map(body.map((b) => [b.date, b]));
  const sleep = dates.map((d) => byDate.get(addDays(d, 1))?.sleepHours);
  const usual = median(
    body.filter((b) => typeof b.sleepHours === "number").map((b) => b.sleepHours!),
  );
  const poorSleep = sleep.map(
    (h) => h !== undefined && usual > 0 && (h < usual - 0.75 || h < 6),
  );

  // Bad nights that followed a missed dose.
  let note: string | null = null;
  const bad = poorSleep.map((p, i) => (p ? i : -1)).filter((i) => i >= 0);
  if (bad.length) {
    const counts = new Map<string, number>();
    for (const i of bad)
      for (const r of rows)
        if (r.cells[i] === "missed" || r.cells[i] === "partial")
          counts.set(r.item.name, (counts.get(r.item.name) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    note =
      top && top[1] >= 1
        ? `${top[1]} of your ${bad.length} rough night${bad.length === 1 ? "" : "s"} came after a missed ${top[0]}.`
        : `${bad.length} rough night${bad.length === 1 ? "" : "s"}, none after a missed dose — something else is going on.`;
  }
  return { dates, rows, sleep, poorSleep, note };
}

export type SkipImpact = {
  metric: "sleepHours" | "restingHr" | "hrv";
  taken: number;
  missed: number;
  missedNights: number;
  takenNights: number;
  /** True when the nights you took it look better. */
  helps: boolean;
};

/**
 * Same supplement, your own A/B test: body signals the night after days you took it vs.
 * days you missed it (last 60 days). Needs at least 3 missed and 5 taken days with data.
 */
export function skipImpact(
  item: StackItem,
  logs: DoseLog[],
  body: BodyLog[],
  today: string,
): SkipImpact[] {
  const byDate = new Map(body.map((b) => [b.date, b]));
  const from = addDays(today, -60) > item.startedAt ? addDays(today, -60) : item.startedAt;
  const out: SkipImpact[] = [];
  for (const metric of ["sleepHours", "hrv", "restingHr"] as const) {
    const taken: number[] = [];
    const missed: number[] = [];
    for (let d = from; d < today; d = addDays(d, 1)) {
      const v = byDate.get(addDays(d, 1))?.[metric];
      if (typeof v !== "number") continue;
      const c = cellFor(item, logs, d, today);
      if (c === "taken") taken.push(v);
      else if (c === "missed") missed.push(v);
    }
    if (missed.length < 3 || taken.length < 5) continue;
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
    const t = avg(taken);
    const m = avg(missed);
    const tiny = metric === "sleepHours" ? 0.2 : 1.5;
    if (Math.abs(t - m) < tiny) continue;
    out.push({
      metric,
      taken: Math.round(t * 10) / 10,
      missed: Math.round(m * 10) / 10,
      missedNights: missed.length,
      takenNights: taken.length,
      helps: metric === "restingHr" ? t < m : t > m,
    });
  }
  return out;
}

export const METRIC_COPY = {
  sleepHours: { label: "Sleep", unit: "h" },
  hrv: { label: "HRV", unit: " ms" },
  restingHr: { label: "Resting HR", unit: " bpm" },
} as const;
