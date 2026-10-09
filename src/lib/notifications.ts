import { LocalNotifications, type LocalNotificationSchema } from "@capacitor/local-notifications";
import { CATALOG_BY_ID } from "./catalog";
import { isNative } from "./platform";
import { activeStack, dayMinutes, effectiveSlotTimes, logicalDate, planDay } from "./protocol";
import { daysOfStock, remainingKeys } from "./stats";
import { useSupplime } from "./store";
import { SLOTS, WAKE_RELATIVE, type SlotId } from "./types";
import { addDays, formatClock, formatHHMM, formatShortDate, parseISODate } from "./utils";

/**
 * Native reminders. Instead of relying on the app being open, Supplime hands Android a
 * rolling two-week schedule of alarms. Whenever the stack, a log, or a setting changes
 * (and every time the app comes back to the foreground) the schedule is rebuilt, so
 * windows you already logged stay quiet and the follow-up nudge is cancelled.
 *
 * Each reminder has three buttons: "Took them", "In 1 hour", and "Not with me". The
 * last one asks Supplime what to do with each supplement (catch up later, or skip).
 */

const CHANNEL = "supplime-reminders";
const STOCK_CHANNEL = "supplime-stock";
const ACTION_DOSE = "supplime-dose";
const ACTION_CATCHUP = "supplime-catchup";
const DAYS_AHEAD = 14;
/** In flexible-wake mode, morning windows wait this long past the usual wake time. */
const FLEX_GRACE = 120;

const SLOT_INDEX = Object.fromEntries(SLOTS.map((s, i) => [s.id, i])) as Record<SlotId, number>;
const reminderId = (day: number, slot: SlotId, nag: boolean) =>
  1000 + day * 20 + SLOT_INDEX[slot] * 2 + (nag ? 1 : 0);
const CATCHUP_BASE = 7000;
const SNOOZE_BASE = 8000;
const STOCK_BASE = 9000;
const FEEL_BASE = 9500;

type Extra = {
  date?: string;
  slot?: SlotId;
  itemId?: string;
  catchUp?: boolean;
  /** "feel": the evening "how was your day?" reminder. */
  kind?: "feel";
};

let setupDone = false;

export async function setupNotifications(handlers: {
  onTake: (date: string, slot: SlotId, itemId?: string) => void;
  onNotWithMe: (date: string, slot: SlotId) => void;
  onSkip: (date: string, slot: SlotId, itemId: string) => void;
  onOpen: (date: string | null, slot: SlotId | null, kind?: Extra["kind"]) => void;
}) {
  if (!isNative() || setupDone) return;
  setupDone = true;
  await LocalNotifications.createChannel({
    id: CHANNEL,
    name: "Supplement reminders",
    description: "When a supplement window opens",
    importance: 5,
    visibility: 1,
    vibration: true,
    lights: true,
  });
  await LocalNotifications.createChannel({
    id: STOCK_CHANNEL,
    name: "Running low",
    description: "When a bottle is about to run out",
    importance: 3,
  });
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: ACTION_DOSE,
        actions: [
          { id: "take", title: "Took them" },
          { id: "later", title: "In 1 hour" },
          { id: "not-with-me", title: "Not with me" },
        ],
      },
      {
        id: ACTION_CATCHUP,
        actions: [
          { id: "take", title: "Took it" },
          { id: "later", title: "In 1 hour" },
          { id: "skip", title: "Skip today" },
        ],
      },
    ],
  });
  await LocalNotifications.addListener("localNotificationActionPerformed", async (event) => {
    const extra = (event.notification.extra ?? {}) as Extra;
    if (event.actionId === "take" && extra.date && extra.slot) {
      handlers.onTake(extra.date, extra.slot, extra.itemId);
      return;
    }
    if (event.actionId === "not-with-me" && extra.date && extra.slot) {
      handlers.onNotWithMe(extra.date, extra.slot);
      return;
    }
    if (event.actionId === "skip" && extra.date && extra.slot && extra.itemId) {
      handlers.onSkip(extra.date, extra.slot, extra.itemId);
      return;
    }
    if (event.actionId === "later") {
      const n = event.notification;
      await LocalNotifications.schedule({
        notifications: [
          {
            ...n,
            id:
              SNOOZE_BASE +
              (extra.catchUp ? 50 + (n.id % 40) : extra.slot ? SLOT_INDEX[extra.slot] : 9),
            title: n.title.startsWith("Reminder") ? n.title : `Reminder · ${n.title}`,
            schedule: { at: new Date(Date.now() + 60 * 60_000), allowWhileIdle: true },
          },
        ],
      });
      return;
    }
    handlers.onOpen(extra.date ?? null, extra.slot ?? null, extra.kind);
  });
}

export async function notificationPermission(): Promise<boolean> {
  if (isNative()) {
    const status = await LocalNotifications.checkPermissions();
    return status.display === "granted";
  }
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (isNative()) {
    let status = await LocalNotifications.checkPermissions();
    if (status.display !== "granted") status = await LocalNotifications.requestPermissions();
    return status.display === "granted";
  }
  if (typeof Notification === "undefined") return false;
  return (await Notification.requestPermission()) === "granted";
}

/** Android 12+ may hold back exact alarms. Returns false when reminders could drift. */
export async function exactAlarmsAllowed(): Promise<boolean> {
  if (!isNative()) return true;
  try {
    const res = await LocalNotifications.checkExactNotificationSetting();
    return res.exact_alarm === "granted";
  } catch {
    return true;
  }
}

export async function openExactAlarmSettings() {
  if (!isNative()) return;
  try {
    await LocalNotifications.changeExactNotificationSetting();
  } catch {
    /* older Android: nothing to change */
  }
}

/** A moment `minutes` into the given logical day (may run past midnight). */
function at(date: string, minutes: number) {
  const d = parseISODate(date);
  // setHours rolls minutes past 24:00 into the next day, in local time (DST-safe).
  d.setHours(0, minutes, 0, 0);
  return d;
}

const doseLabel = (name: string, amount: number, unit: string) =>
  `${name} ${amount}${unit === "mg" || unit === "g" ? "" : " "}${unit}`;

/** Evening check-in: on by default, an hour before bed. */
export function feelReminder(profile: { rhythm: { bed: string; wake: string }; feelReminder?: { enabled: boolean; time?: string } }) {
  const bed = dayMinutes(profile.rhythm.bed, profile.rhythm.wake);
  return {
    enabled: profile.feelReminder?.enabled ?? true,
    time: profile.feelReminder?.time ?? formatHHMM((bed - 60) % 1440),
  };
}

/** Pure planner, exported for tests: which notifications should exist right now. */
export function buildSchedule(now = new Date()): LocalNotificationSchema[] {
  const { profile, stack, logs, days } = useSupplime.getState();
  if (!profile.notifications || !profile.onboarded) return [];
  const out: LocalNotificationSchema[] = [];
  const wake = profile.rhythm.wake;
  const today = logicalDate(now, profile.rhythm);
  const lead = Math.max(0, profile.reminderLeadMinutes || 0);
  const nag = Math.max(0, profile.nagMinutes || 0);
  const deferredKeys = new Set(
    logs.filter((l) => l.status === "deferred").map((l) => `${l.date}:${l.itemId}:${l.slot}`),
  );

  for (let day = 0; day < DAYS_AHEAD; day++) {
    const date = addDays(today, day);
    const { times, wokeAt } = effectiveSlotTimes(profile, days, date);
    const dayStack = stack.filter((item) => item.startedAt <= date);
    const plans = planDay(dayStack, times, 0, wake);
    const remaining = remainingKeys(dayStack, logs, date);
    for (const plan of plans) {
      const open = plan.waves
        .flatMap((w) => w.doses)
        .filter(
          (d) =>
            remaining.has(`${d.item.id}:${d.slot}`) &&
            !deferredKeys.has(`${date}:${d.item.id}:${d.slot}`),
        );
      if (open.length === 0) continue;
      const waitForWake =
        profile.rhythm.flexibleWake && !wokeAt && WAKE_RELATIVE.includes(plan.slot.id);
      const minutes = plan.minutes + (waitForWake ? FLEX_GRACE : 0);
      const names = open.map((d) => doseLabel(d.item.name, d.item.amount, d.item.unit));
      const emptyFirst =
        plan.waves.some((w) => w.key === "empty") && plan.waves.some((w) => w.key !== "empty");
      const body = names.join(", ");
      const hint = emptyFirst
        ? "Empty-stomach ones first, then eat."
        : (plan.waves[0]?.instruction ?? "");
      const base = {
        channelId: CHANNEL,
        actionTypeId: ACTION_DOSE,
        smallIcon: "ic_stat_supplime",
        iconColor: "#3D5A4C",
        group: `slot-${plan.slot.id}`,
        autoCancel: true,
        extra: { date, slot: plan.slot.id } satisfies Extra,
      } satisfies Partial<LocalNotificationSchema>;

      const fireAt = at(date, Math.max(0, minutes - (waitForWake ? 0 : lead)));
      if (fireAt.getTime() > now.getTime()) {
        out.push({
          ...base,
          id: reminderId(day, plan.slot.id, false),
          title: waitForWake
            ? `When you're up · ${plan.slot.label}`
            : `${plan.slot.label} · ${formatClock(plan.time)}`,
          body,
          largeBody: `${body}\n${hint}`,
          schedule: { at: fireAt, allowWhileIdle: true },
        });
      }
      if (nag > 0) {
        const nagAt = at(date, minutes + nag);
        if (nagAt.getTime() > now.getTime()) {
          out.push({
            ...base,
            id: reminderId(day, plan.slot.id, true),
            title: `Still open · ${plan.slot.label}`,
            body,
            largeBody: `${body}\nTap "Took them" if you already did, or "Not with me" and Supplime will plan a catch-up.`,
            schedule: { at: nagAt, allowWhileIdle: true },
          });
        }
      }
    }
  }

  // Catch-ups you scheduled with "Not with me" / "Later".
  logs
    .filter((l) => l.status === "deferred" && l.remindAt && l.date >= addDays(today, -1))
    .forEach((log, i) => {
      const item = stack.find((s) => s.id === log.itemId);
      if (!item) return;
      const when = at(log.date, dayMinutes(log.remindAt!, wake));
      if (when.getTime() <= now.getTime()) return;
      out.push({
        id: CATCHUP_BASE + i,
        channelId: CHANNEL,
        actionTypeId: ACTION_CATCHUP,
        smallIcon: "ic_stat_supplime",
        iconColor: "#3D5A4C",
        autoCancel: true,
        title: `Catch-up · ${item.name}`,
        body: `${doseLabel(item.name, item.amount, item.unit)}${item.foodTiming === "with" ? " — with food" : ""}`,
        schedule: { at: when, allowWhileIdle: true },
        extra: { date: log.date, slot: log.slot, itemId: item.id, catchUp: true } satisfies Extra,
      });
    });

  // Evening "how was your day?" (Settings can turn it off).
  const feel = feelReminder(profile);
  if (feel.enabled) {
    const rated = new Set(
      useSupplime
        .getState()
        .body.filter((b) => typeof b.energy === "number")
        .map((b) => b.date),
    );
    for (let day = 0; day < 7; day++) {
      const date = addDays(today, day);
      if (rated.has(date)) continue;
      const when = at(date, dayMinutes(feel.time, wake));
      if (when.getTime() <= now.getTime()) continue;
      out.push({
        id: FEEL_BASE + day,
        channelId: CHANNEL,
        smallIcon: "ic_stat_supplime",
        iconColor: "#3D5A4C",
        autoCancel: true,
        title: "How was your day?",
        body: "Rate your energy, mood, focus and calm, and add a note or an affirmation. 10 seconds.",
        schedule: { at: when, allowWhileIdle: true },
        extra: { date, kind: "feel" } satisfies Extra,
      });
    }
  }

  // One heads-up per bottle on the morning it crosses its reorder threshold.
  activeStack(stack).forEach((item, i) => {
    const left = daysOfStock(item);
    const until = left - item.reorderAtDays;
    if (until < 1 || until > 60) return;
    const when = at(addDays(today, until), 10 * 60);
    if (when.getTime() <= now.getTime()) return;
    const cat = item.catalogId ? CATALOG_BY_ID[item.catalogId] : undefined;
    out.push({
      id: STOCK_BASE + i,
      channelId: STOCK_CHANNEL,
      smallIcon: "ic_stat_supplime",
      iconColor: "#3D5A4C",
      title: `${item.name} is running low`,
      body: `About ${item.reorderAtDays} days left — runs out around ${formatShortDate(addDays(today, left))}. Time to reorder${cat?.name ? "" : " this one"}.`,
      schedule: { at: when, allowWhileIdle: true },
      extra: { date: null, slot: null },
    });
  });

  return out;
}

let syncing: Promise<void> | null = null;
let again = false;

/** Rebuild the native alarm schedule from the current store state. */
export async function syncReminders(): Promise<void> {
  if (!isNative()) return;
  if (syncing) {
    again = true;
    return syncing;
  }
  syncing = (async () => {
    try {
      do {
        again = false;
        const pending = await LocalNotifications.getPending();
        // A "later" reminder survives a rebuild only while there is still something open.
        const { stack, logs, profile } = useSupplime.getState();
        const today = logicalDate(new Date(), profile.rhythm);
        const open = remainingKeys(stack, logs, today);
        const keep = pending.notifications.filter((n) => {
          if (n.id < SNOOZE_BASE || n.id >= STOCK_BASE) return false;
          const extra = (n.extra ?? {}) as Extra;
          if (extra.itemId) return open.has(`${extra.itemId}:${extra.slot}`);
          return !!extra.slot && [...open].some((key) => key.endsWith(`:${extra.slot}`));
        });
        const toCancel = pending.notifications.filter((n) => !keep.includes(n));
        if (toCancel.length) {
          await LocalNotifications.cancel({ notifications: toCancel.map((n) => ({ id: n.id })) });
        }
        if (!(await notificationPermission())) continue;
        const next = buildSchedule();
        if (next.length) await LocalNotifications.schedule({ notifications: next });
      } while (again);
    } catch (err) {
      console.warn("Supplime: could not sync reminders", err);
    } finally {
      syncing = null;
    }
  })();
  return syncing;
}

/** Clear the reminders for a slot from the notification shade once it is logged. */
export async function clearDelivered(slot: SlotId) {
  if (!isNative()) return;
  try {
    const delivered = await LocalNotifications.getDeliveredNotifications();
    const mine = delivered.notifications.filter(
      (n) => (n.extra as Extra | undefined)?.slot === slot,
    );
    if (mine.length) await LocalNotifications.removeDeliveredNotifications({ notifications: mine });
  } catch {
    /* not critical */
  }
}
