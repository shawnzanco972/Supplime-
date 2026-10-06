import { LocalNotifications, type LocalNotificationSchema } from "@capacitor/local-notifications";
import { CATALOG_BY_ID } from "./catalog";
import { isNative } from "./platform";
import { activeStack, planDay } from "./protocol";
import { daysOfStock, remainingKeys } from "./stats";
import { useSupplime } from "./store";
import { SLOTS, type SlotId } from "./types";
import { addDays, formatClock, parseHHMM, parseISODate, todayKey } from "./utils";

/**
 * Native reminders. Instead of relying on the app being open, Supplime hands Android a
 * rolling two-week schedule of alarms. Whenever the stack, a log, or a setting changes
 * (and every time the app comes back to the foreground) the schedule is rebuilt, so
 * windows you already logged today stay quiet and the follow-up nudge is cancelled.
 */

const CHANNEL = "supplime-reminders";
const STOCK_CHANNEL = "supplime-stock";
const ACTION_TYPE = "supplime-dose";
const DAYS_AHEAD = 14;

const SLOT_INDEX = Object.fromEntries(SLOTS.map((s, i) => [s.id, i])) as Record<SlotId, number>;
const reminderId = (day: number, slot: SlotId, nag: boolean) =>
  1000 + day * 20 + SLOT_INDEX[slot] * 2 + (nag ? 1 : 0);
const SNOOZE_BASE = 8000;
const STOCK_BASE = 9000;

let setupDone = false;

export async function setupNotifications(handlers: {
  onTake: (date: string, slot: SlotId) => void;
  onOpen: (date: string | null, slot: SlotId | null) => void;
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
        id: ACTION_TYPE,
        actions: [
          { id: "take", title: "Took them" },
          { id: "snooze", title: "Snooze 15 min" },
        ],
      },
    ],
  });
  await LocalNotifications.addListener("localNotificationActionPerformed", async (event) => {
    const extra = (event.notification.extra ?? {}) as { date?: string; slot?: SlotId };
    if (event.actionId === "take" && extra.date && extra.slot) {
      handlers.onTake(extra.date, extra.slot);
      return;
    }
    if (event.actionId === "snooze") {
      await LocalNotifications.schedule({
        notifications: [
          {
            ...event.notification,
            id: SNOOZE_BASE + (extra.slot ? SLOT_INDEX[extra.slot] : 9),
            title: event.notification.title.startsWith("Snoozed")
              ? event.notification.title
              : `Snoozed · ${event.notification.title}`,
            schedule: { at: new Date(Date.now() + 15 * 60_000), allowWhileIdle: true },
          },
        ],
      });
      return;
    }
    handlers.onOpen(extra.date ?? null, extra.slot ?? null);
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

function at(date: string, minutes: number) {
  const d = parseISODate(date);
  d.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return d;
}

/** Pure planner, exported for tests: which notifications should exist right now. */
export function buildSchedule(now = new Date()): LocalNotificationSchema[] {
  const { profile, stack, logs } = useSupplime.getState();
  if (!profile.notifications || !profile.onboarded) return [];
  const out: LocalNotificationSchema[] = [];
  const today = todayKey(now);
  const lead = Math.max(0, profile.reminderLeadMinutes || 0);
  const nag = Math.max(0, profile.nagMinutes || 0);

  for (let day = 0; day < DAYS_AHEAD; day++) {
    const date = addDays(today, day);
    const dayStack = stack.filter((item) => item.startedAt <= date);
    const plans = planDay(dayStack, profile.slotTimes);
    const remaining = remainingKeys(dayStack, logs, date);
    for (const plan of plans) {
      const open = plan.waves
        .flatMap((w) => w.doses)
        .filter((d) => remaining.has(`${d.item.id}:${d.slot}`));
      if (open.length === 0) continue;
      const names = open.map(
        (d) =>
          `${d.item.name} ${d.item.amount}${d.item.unit === "mg" || d.item.unit === "g" ? "" : " "}${d.item.unit}`,
      );
      const emptyFirst =
        plan.waves.some((w) => w.key === "empty") && plan.waves.some((w) => w.key !== "empty");
      const body = names.join(", ");
      const hint = emptyFirst
        ? "Empty-stomach ones first, then eat."
        : (plan.waves[0]?.instruction ?? "");
      const base = {
        channelId: CHANNEL,
        actionTypeId: ACTION_TYPE,
        smallIcon: "ic_stat_supplime",
        iconColor: "#3D5A4C",
        group: `slot-${plan.slot.id}`,
        autoCancel: true,
        extra: { date, slot: plan.slot.id },
      } satisfies Partial<LocalNotificationSchema>;

      const fireAt = at(date, Math.max(0, plan.minutes - lead));
      if (fireAt.getTime() > now.getTime()) {
        out.push({
          ...base,
          id: reminderId(day, plan.slot.id, false),
          title: `${plan.slot.label} · ${formatClock(plan.time)}`,
          body,
          largeBody: `${body}\n${hint}`,
          schedule: { at: fireAt, allowWhileIdle: true },
        });
      }
      if (nag > 0) {
        const nagAt = at(date, plan.minutes + nag);
        if (nagAt.getTime() > now.getTime() && nagAt.getDate() === parseISODate(date).getDate()) {
          out.push({
            ...base,
            id: reminderId(day, plan.slot.id, true),
            title: `Still open · ${plan.slot.label}`,
            body,
            largeBody: `${body}\nTap "Took them" if you already did.`,
            schedule: { at: nagAt, allowWhileIdle: true },
          });
        }
      }
    }
  }

  // One heads-up per bottle on the morning it crosses its reorder threshold.
  activeStack(stack).forEach((item, i) => {
    const left = daysOfStock(item);
    const until = left - item.reorderAtDays;
    if (until < 1 || until > 60) return;
    const when = at(addDays(today, until), parseHHMM("10:00"));
    if (when.getTime() <= now.getTime()) return;
    const cat = item.catalogId ? CATALOG_BY_ID[item.catalogId] : undefined;
    out.push({
      id: STOCK_BASE + i,
      channelId: STOCK_CHANNEL,
      smallIcon: "ic_stat_supplime",
      iconColor: "#3D5A4C",
      title: `${item.name} is running low`,
      body: `About ${item.reorderAtDays} days left. Time to reorder${cat ? "" : " this one"}.`,
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
        // A snooze survives a rebuild only while that window still has something open.
        const { stack, logs } = useSupplime.getState();
        const open = remainingKeys(stack, logs, todayKey());
        const keepSnoozes = pending.notifications.filter((n) => {
          if (n.id < SNOOZE_BASE || n.id >= STOCK_BASE) return false;
          const slot = (n.extra as { slot?: SlotId } | undefined)?.slot;
          return !!slot && [...open].some((key) => key.endsWith(`:${slot}`));
        });
        const toCancel = pending.notifications.filter((n) => !keepSnoozes.includes(n));
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
      (n) => (n.extra as { slot?: SlotId } | undefined)?.slot === slot,
    );
    if (mine.length) await LocalNotifications.removeDeliveredNotifications({ notifications: mine });
  } catch {
    /* not critical */
  }
}
