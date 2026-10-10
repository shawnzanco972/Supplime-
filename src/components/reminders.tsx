import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { requestNotificationPermission, syncReminders } from "@/lib/notifications";
import { isNative } from "@/lib/platform";
import { effectiveSlotTimes, logicalDate, nextSlot, nowInDay, planDay } from "@/lib/protocol";
import { remainingKeys } from "@/lib/stats";
import { useSupplime } from "@/lib/store";
import { formatClock, minutesNow, parseHHMM } from "@/lib/utils";

/**
 * On Android the real work happens in native alarms (see lib/notifications). This
 * component just keeps that schedule in sync with what you log. In a browser it falls
 * back to the original in-tab reminder loop.
 */
export function ReminderEngine({ now }: { now: number }) {
  const stack = useSupplime((s) => s.stack);
  const logs = useSupplime((s) => s.logs);
  const profile = useSupplime((s) => s.profile);
  const days = useSupplime((s) => s.days);
  const fired = useRef(new Set<string>());

  // Native: rebuild the alarm schedule after any relevant change (debounced) and when
  // the app wakes up on a new day (`now` ticks on resume).
  useEffect(() => {
    if (!isNative()) return;
    const id = window.setTimeout(() => void syncReminders(), 400);
    return () => window.clearTimeout(id);
  }, [
    stack,
    logs,
    profile.notifications,
    profile.slotTimes,
    profile.reminderLeadMinutes,
    profile.nagMinutes,
    profile.onboarded,
    profile.feelReminder,
    profile.mealReminders,
    profile.rhythm,
    days,
    now,
  ]);

  // Browser fallback.
  useEffect(() => {
    if (isNative()) return;
    if (!profile.notifications || !profile.onboarded) return;

    const tick = () => {
      const d = new Date();
      const date = logicalDate(d, profile.rhythm);
      const nowMin = nowInDay(d, profile.rhythm);
      const { times } = effectiveSlotTimes(profile, days, date);
      const plans = planDay(stack, times, nowMin, profile.rhythm.wake);
      const remaining = remainingKeys(stack, logs, date);
      const nxt = nextSlot(plans, remaining, nowMin);
      if (!nxt) return;
      const lead = profile.reminderLeadMinutes;
      const key = `${date}:${nxt.slot.id}`;
      if (fired.current.has(key)) return;
      if (nowMin >= nxt.minutes - lead && nowMin <= nxt.minutes + 20) {
        fired.current.add(key);
        const names = nxt.waves
          .flatMap((w) => w.doses)
          .filter((d) => remaining.has(`${d.item.id}:${d.slot}`))
          .map((d) => d.item.name);
        if (names.length === 0) return;
        const title = `${nxt.slot.label} · ${formatClock(nxt.time)}`;
        const body = names.slice(0, 4).join(", ");
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          try {
            new Notification(title, { body, tag: `supplime-${nxt.slot.id}` });
          } catch {
            /* ignore */
          }
        }
        toast(title, { description: body });
      }
    };

    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, [stack, logs, profile, days]);

  return null;
}

export async function enableNotifications() {
  return requestNotificationPermission();
}

export function minutesUntil(time: string) {
  return parseHHMM(time) - minutesNow();
}
