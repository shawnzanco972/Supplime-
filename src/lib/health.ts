import { Health, type HealthDataType, type HealthSample } from "@capgo/capacitor-health";
import { isNative } from "./platform";
import { logicalDate } from "./protocol";
import { appToday, useSupplime } from "./store";
import type { BodyLog } from "./types";
import { formatHHMM, parseHHMM, todayKey } from "./utils";

/**
 * Health Connect is Android's shared health store. Fitbit / Google Health write sleep,
 * resting heart rate, HRV and steps into it; Supplime only reads them, so it can show
 * how they change while you take each supplement. Nothing leaves the phone.
 */

const READ: HealthDataType[] = [
  "sleep",
  "restingHeartRate",
  "heartRateVariability",
  "steps",
  "exerciseTime",
  "oxygenSaturation",
];

export async function healthAvailable(): Promise<{ ok: boolean; reason?: string }> {
  if (!isNative()) return { ok: false, reason: "Only in the Android app." };
  try {
    const r = await Health.isAvailable();
    return { ok: r.available, reason: r.reason };
  } catch (err) {
    return { ok: false, reason: String(err) };
  }
}

export async function connectHealth(): Promise<boolean> {
  const avail = await healthAvailable();
  if (!avail.ok) return false;
  const status = await Health.requestAuthorization({ read: READ, requestHistoryAccess: true });
  return status.readAuthorized.length > 0;
}

export async function openHealthSettings() {
  if (!isNative()) return;
  try {
    await Health.openHealthConnectSettings();
  } catch {
    /* ignore */
  }
}

/** Local calendar day a sample belongs to (sleep counts for the morning you woke up). */
const dayOf = (iso: string) => todayKey(new Date(iso));

function asleepMinutes(s: HealthSample) {
  if (s.stages?.length) {
    return s.stages
      .filter((st) => st.stage !== "awake" && st.stage !== "inBed")
      .reduce((n, st) => n + st.durationMinutes, 0);
  }
  if (s.sleepState === "awake" || s.sleepState === "inBed") return 0;
  return (Date.parse(s.endDate) - Date.parse(s.startDate)) / 60_000;
}

/** Pull the last `days` days and merge them into the body log. Returns days updated. */
export async function syncHealth(days = 45): Promise<number> {
  if (!isNative()) return 0;
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const range = { startDate: start.toISOString(), endDate: end.toISOString() };
  const byDate = new Map<string, BodyLog>();
  const row = (date: string) => {
    let r = byDate.get(date);
    if (!r) {
      r = { date, source: "fitbit" };
      byDate.set(date, r);
    }
    return r;
  };
  const safe = async <T>(fn: () => Promise<T>) => {
    try {
      return await fn();
    } catch {
      return null;
    }
  };

  const sleep = await safe(() => Health.readSamples({ dataType: "sleep", ...range, limit: 1000 }));
  const sleepByDay = new Map<string, number>();
  for (const s of sleep?.samples ?? []) {
    const d = dayOf(s.endDate);
    sleepByDay.set(d, (sleepByDay.get(d) ?? 0) + asleepMinutes(s));
  }
  for (const [d, min] of sleepByDay)
    if (min > 60) row(d).sleepHours = Math.round((min / 60) * 10) / 10;
  // Deep and REM minutes, when Fitbit shares sleep stages.
  const stageBy = new Map<string, { deep: number; rem: number }>();
  for (const s of sleep?.samples ?? []) {
    const d = dayOf(s.endDate);
    const acc = stageBy.get(d) ?? { deep: 0, rem: 0 };
    for (const st of s.stages ?? []) {
      if (st.stage === "deep") acc.deep += st.durationMinutes;
      if (st.stage === "rem") acc.rem += st.durationMinutes;
    }
    if (!s.stages?.length && s.sleepState === "deep")
      acc.deep += (Date.parse(s.endDate) - Date.parse(s.startDate)) / 60_000;
    if (!s.stages?.length && s.sleepState === "rem")
      acc.rem += (Date.parse(s.endDate) - Date.parse(s.startDate)) / 60_000;
    stageBy.set(d, acc);
  }
  for (const [d, a] of stageBy) {
    if (a.deep > 0) row(d).deepMin = Math.round(a.deep);
    if (a.rem > 0) row(d).remMin = Math.round(a.rem);
  }

  const avgInto = async (type: HealthDataType, key: "restingHr" | "hrv" | "spo2") => {
    const res = await safe(() => Health.readSamples({ dataType: type, ...range, limit: 5000 }));
    const acc = new Map<string, number[]>();
    for (const s of res?.samples ?? []) {
      const d = dayOf(s.startDate);
      acc.set(d, [...(acc.get(d) ?? []), s.value]);
    }
    for (const [d, vals] of acc)
      row(d)[key] = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
  };
  await avgInto("restingHeartRate", "restingHr");
  await avgInto("heartRateVariability", "hrv");
  await avgInto("oxygenSaturation", "spo2");

  const steps = await safe(() =>
    Health.queryAggregated({ dataType: "steps", ...range, bucket: "day", aggregation: "sum" }),
  );
  for (const s of steps?.samples ?? [])
    if (s.value > 0) row(dayOf(s.startDate)).steps = Math.round(s.value);

  const active = await safe(() =>
    Health.queryAggregated({
      dataType: "exerciseTime",
      ...range,
      bucket: "day",
      aggregation: "sum",
    }),
  );
  for (const s of active?.samples ?? [])
    if (s.value > 0) row(dayOf(s.startDate)).activeMin = Math.round(s.value);

  const entries = [...byDate.values()];
  if (entries.length) useSupplime.getState().importBody(entries);
  useSupplime.getState().setProfile({
    healthSync: { enabled: true, lastSync: new Date().toISOString(), scope: READ.length },
  });
  return entries.length;
}

/** Sync quietly if it's been a while (called when the app opens). */
/** Ask again when this version reads more data types than you granted before. */
export function needsMorePermissions() {
  const sync = useSupplime.getState().profile.healthSync;
  return !!sync?.enabled && (sync.scope ?? 4) < READ.length;
}

export async function maybeSyncHealth() {
  const sync = useSupplime.getState().profile.healthSync;
  if (!sync?.enabled) return;
  if (sync.lastSync && Date.now() - Date.parse(sync.lastSync) < 6 * 3_600_000) return;
  await syncHealth(14);
}

/**
 * When you really got up today, from last night's sleep in Health Connect: the end of the
 * last sleep session of at least 3 hours that ended this morning. Fitbit usually syncs it
 * within minutes of you opening the Fitbit / Google Health app.
 */
export async function detectWake(): Promise<string | null> {
  if (!isNative()) return null;
  const { profile } = useSupplime.getState();
  const now = new Date();
  const start = new Date(now.getTime() - 20 * 3_600_000);
  let res;
  try {
    res = await Health.readSamples({
      dataType: "sleep",
      startDate: start.toISOString(),
      endDate: now.toISOString(),
      limit: 200,
    });
  } catch {
    return null;
  }
  // Merge stage segments into sessions: gaps under 45 minutes are the same night.
  const parts = (res?.samples ?? [])
    .map((x) => ({ s: Date.parse(x.startDate), e: Date.parse(x.endDate) }))
    .filter((x) => x.e > x.s)
    .sort((a, b) => a.s - b.s);
  const sessions: { s: number; e: number }[] = [];
  for (const p of parts) {
    const last = sessions.at(-1);
    if (last && p.s - last.e < 45 * 60_000) last.e = Math.max(last.e, p.e);
    else sessions.push({ ...p });
  }
  const main = sessions.filter((x) => x.e - x.s >= 3 * 3_600_000).at(-1);
  if (!main) return null;
  const end = new Date(main.e);
  // Must be this morning (in your day), not yesterday's.
  if (logicalDate(end, profile.rhythm) !== logicalDate(now, profile.rhythm)) return null;
  return formatHHMM(end.getHours() * 60 + end.getMinutes());
}

let lastWakeCheck = 0;
/** Fill in today's wake time from the watch, unless you already said when you got up. */
export async function maybeDetectWake() {
  const state = useSupplime.getState();
  if (!state.profile.healthSync?.enabled) return;
  if (Date.now() - lastWakeCheck < 15 * 60_000) return;
  lastWakeCheck = Date.now();
  const date = appToday();
  const day = state.days.find((d) => d.date === date);
  if (day?.wokeAt && day.wakeSource !== "inferred") return;
  const woke = await detectWake();
  if (!woke) return;
  // Your first log said "up by"; the watch knows better unless it says later than that.
  if (day?.wokeAt && parseHHMM(woke) > parseHHMM(day.wokeAt)) return;
  state.setDay(date, { wokeAt: woke, wakeSource: "watch" });
}
