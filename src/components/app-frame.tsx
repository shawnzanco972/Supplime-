import { HistoryScreen } from "@/components/history-screen";
import { App as CapApp } from "@capacitor/app";
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { AddScreen } from "@/components/add-sheet";
import { AppShell } from "@/components/app-shell";
import { BodyView } from "@/components/body-view";
import { ItemEditor } from "@/components/item-editor";
import { EvaluateSheet, JourneyView } from "@/components/journey-view";
import { NotNowSheet } from "@/components/not-now-sheet";
import { Onboarding } from "@/components/onboarding";
import { ReminderEngine } from "@/components/reminders";
import { SettingsScreen } from "@/components/settings-sheet";
import { StackView } from "@/components/stack-view";
import { TodayView } from "@/components/today-view";
import { missedAdvice } from "@/lib/missed";
import { useNav } from "@/lib/nav";
import { clearDelivered, setupNotifications } from "@/lib/notifications";
import { isNative } from "@/lib/platform";
import { effectiveSlotTimes, nowInDay, planDay } from "@/lib/protocol";
import { maybeDetectWake, maybeSyncHealth } from "@/lib/health";
import { listenForShares } from "@/lib/share";
import { remainingKeys } from "@/lib/stats";
import { useSupplime } from "@/lib/store";
import type { SlotId } from "@/lib/types";
import { formatClock } from "@/lib/utils";

/** Still-open doses in one window on one day. */
function openDoses(date: string, slot: SlotId) {
  const { stack, logs, profile, days } = useSupplime.getState();
  const dayStack = stack.filter((item) => item.startedAt <= date);
  const remaining = remainingKeys(dayStack, logs, date);
  const { times } = effectiveSlotTimes(profile, days, date);
  const deferred = new Set(
    logs
      .filter((l) => l.date === date && l.status === "deferred")
      .map((l) => `${l.itemId}:${l.slot}`),
  );
  const plan = planDay(dayStack, times, 0, profile.rhythm.wake).find((p) => p.slot.id === slot);
  return (plan?.waves.flatMap((w) => w.doses) ?? []).filter(
    (d) => remaining.has(`${d.item.id}:${d.slot}`) && !deferred.has(`${d.item.id}:${d.slot}`),
  );
}

/** "Took them" from a notification: log every open dose in that window. */
export function takeWholeSlot(date: string, slot: SlotId) {
  const { logDose } = useSupplime.getState();
  const doses = openDoses(date, slot);
  for (const dose of doses) logDose(dose.item.id, dose.slot, "taken", date);
  void clearDelivered(slot);
  return doses.length;
}

/** "Not with me" from a notification: plan a catch-up or a skip for each dose. */
export function notWithMe(date: string, slot: SlotId) {
  const { profile, days, deferDose, logDose } = useSupplime.getState();
  const { times } = effectiveSlotTimes(profile, days, date);
  const now = nowInDay(new Date(), profile.rhythm);
  const plan: string[] = [];
  for (const dose of openDoses(date, slot)) {
    const a = missedAdvice({
      item: dose.item,
      slot,
      reason: "not-with-me",
      now,
      times,
      rhythm: profile.rhythm,
    });
    if (a.action === "catch-up" && a.suggestAt) {
      deferDose(dose.item.id, slot, a.suggestAt, "not-with-me", date);
      plan.push(`${dose.item.name} at ${formatClock(a.suggestAt)}`);
    } else {
      logDose(dose.item.id, slot, "skipped", date, { reason: "not-with-me" });
      plan.push(`${dose.item.name}: skip today`);
    }
  }
  void clearDelivered(slot);
  return plan;
}

export function AppFrame() {
  const hydrated = useSupplime((s) => s.hydrated);
  const onboarded = useSupplime((s) => s.profile.onboarded);
  const { tab, overlay, open } = useNav();
  // Bumps every minute and when the app returns, so "due now", today's date and the
  // reminder schedule never go stale.
  const [now, setNow] = useState(() => Date.now());
  // A dose change scheduled for "tomorrow" starts when the new day begins.
  useEffect(() => {
    useSupplime.getState().applyPendingDoses();
  }, [now]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    const onVisible = () => document.visibilityState === "visible" && setNow(Date.now());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  useEffect(() => {
    if (!isNative()) return;
    void setupNotifications({
      onTake: (date, slot, itemId) => {
        if (itemId) {
          useSupplime.getState().logDose(itemId, slot, "taken", date, { late: true });
          toast("Caught up. Nice.");
        } else {
          const n = takeWholeSlot(date, slot);
          if (n > 0) toast(`Logged ${n} dose${n === 1 ? "" : "s"}`);
        }
        useNav.getState().go("today");
      },
      onNotWithMe: (date, slot) => {
        const plan = notWithMe(date, slot);
        if (plan.length)
          toast("Catch-up planned", { description: plan.join(" · "), duration: 8000 });
        useNav.getState().go("today");
      },
      onSkip: (date, slot, itemId) => {
        useSupplime.getState().logDose(itemId, slot, "skipped", date, { reason: "not-with-me" });
      },
      onOpen: (_date, _slot, kind) => useNav.getState().go(kind === "feel" ? "body" : "today"),
    });
    const stopShares = listenForShares((text) => useNav.getState().open({ kind: "add", text }));
    void maybeSyncHealth();
    void maybeDetectWake();
    const resume = CapApp.addListener("resume", () => {
      setNow(Date.now());
      void maybeSyncHealth();
      void maybeDetectWake();
    });
    // Android back: close an open panel first, then go back to Today, then leave the app.
    const back = CapApp.addListener("backButton", () => {
      if (useNav.getState().overlay || document.querySelector('[role="dialog"]')) {
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        return;
      }
      if (useNav.getState().tab !== "today") {
        useNav.getState().go("today");
        return;
      }
      void CapApp.minimizeApp();
    });
    return () => {
      stopShares();
      void resume.then((h) => h.remove());
      void back.then((h) => h.remove());
    };
  }, []);

  if (!hydrated) {
    return (
      <div className="flex min-h-dvh flex-col justify-end px-6 py-16">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Supplime
        </p>
        <h1 className="mt-4 font-display text-4xl tracking-tight">Your stack, on time.</h1>
      </div>
    );
  }

  if (!onboarded) {
    return (
      <>
        <Onboarding />
        <Toaster position="top-center" richColors={false} />
      </>
    );
  }

  return (
    <>
      <AppShell onOpenSettings={() => open({ kind: "settings" })}>
        {tab === "today" && <TodayView now={now} />}
        {tab === "stack" && <StackView />}
        {tab === "journey" && <JourneyView />}
        {tab === "body" && <BodyView />}
      </AppShell>
      {overlay?.kind === "editor" && <ItemEditor itemId={overlay.itemId} />}
      {overlay?.kind === "add" && <AddScreen text={overlay.text} />}
      {overlay?.kind === "evaluate" && <EvaluateSheet itemId={overlay.itemId} />}
      {overlay?.kind === "not-now" && (
        <NotNowSheet itemId={overlay.itemId} slot={overlay.slot} date={overlay.date} />
      )}
      {overlay?.kind === "settings" && <SettingsScreen />}
      {overlay?.kind === "history" && <HistoryScreen itemId={overlay.itemId} />}
      <ReminderEngine now={now} />
      <Toaster position="top-center" richColors={false} />
    </>
  );
}
