import type { BodyLog } from "./types";
import { todayKey } from "./utils";

function splitCSVLine(line: string) {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      quoted = !quoted;
      continue;
    }
    if (ch === "," && !quoted) {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function toDateKey(raw: string) {
  const value = raw.trim().replace(/\//g, "-");
  const iso = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const us = value.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (us) {
    return `${us[3]}-${String(us[1]).padStart(2, "0")}-${String(us[2]).padStart(2, "0")}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return todayKey(parsed);
}

function num(raw: string | undefined) {
  if (!raw) return undefined;
  const n = Number(raw.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

export function parseFitbitCsv(text: string): BodyLog[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const header = splitCSVLine(lines[0] ?? "").map((h) => h.toLowerCase());
  const idx = (names: string[]) => header.findIndex((h) => names.some((n) => h.includes(n)));
  const dateIdx = idx(["date", "start time", "datetime", "day"]);
  const sleepMinIdx = idx(["minutes asleep", "minutesasleep", "totalminutesasleep", "min asleep"]);
  const sleepHrsIdx = idx(["hours of sleep", "time in bed", "sleep hours"]);
  const scoreIdx = idx(["sleep score", "overall score", "score"]);
  const rhrIdx = idx(["resting heart", "resting hr", "rhr"]);
  const hrvIdx = idx(["hrv", "rmssd"]);
  const stepsIdx = idx(["steps"]);
  if (dateIdx < 0) return [];

  const map = new Map<string, BodyLog>();
  for (const line of lines.slice(1)) {
    const cols = splitCSVLine(line);
    const date = toDateKey(cols[dateIdx] ?? "");
    if (!date) continue;
    const prev = map.get(date) ?? { date, source: "fitbit" as const };
    const sleepMin = num(cols[sleepMinIdx]);
    const sleepHrs = num(cols[sleepHrsIdx]);
    const hours =
      sleepMin != null
        ? Math.round((sleepMin / 60) * 10) / 10
        : sleepHrs != null
          ? sleepHrs
          : prev.sleepHours;
    const next: BodyLog = {
      ...prev,
      sleepHours: hours,
      sleepScore: num(cols[scoreIdx]) ?? prev.sleepScore,
      restingHr: num(cols[rhrIdx]) ?? prev.restingHr,
      hrv: num(cols[hrvIdx]) ?? prev.hrv,
      steps: num(cols[stepsIdx]) ?? prev.steps,
      source: "fitbit",
    };
    map.set(date, next);
  }
  return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function fitbitExportHint() {
  return "Export from Fitbit (data export or a sleep/RHR CSV). Columns we read: Date, Minutes Asleep, Sleep Score, Resting Heart Rate, HRV, Steps.";
}
