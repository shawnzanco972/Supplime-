import { App as CapApp } from "@capacitor/app";
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { AddSheet } from "@/components/add-sheet";
import { AppShell } from "@/components/app-shell";
import { BodyView } from "@/components/body-view";
import { InsightsView } from "@/components/insights-view";
import { Onboarding } from "@/components/onboarding";
import { ReminderEngine } from "@/components/reminders";
import { SettingsSheet } from "@/components/settings-sheet";
import { StackView } from "@/components/stack-view";
import { TodayView } from "@/components/today-view";
import { useNav } from "@/lib/nav";
import { clearDelivered, setupNotifications } from "@/lib/notifications";
import { isNative } from "@/lib/platform";
import { planDay } from "@/lib/protocol";
import { remainingKeys } from "@/lib/stats";
import { useSupplime } from "@/lib/store";
import type { SlotId } from "@/lib/types";

/** Log every still-open dose in a window (used by the "Took them" notification button). */
export function takeWholeSlot(date: string, slot: SlotId) {
  const { stack, logs, profile, logDose } = useSupplime.getState();
  const dayStack = stack.filter((item) => item.startedAt <= date);
  const remaining = remainingKeys(dayStack, logs, date);
  const plan = planDay(dayStack, profile.slotTimes).find((p) => p.slot.id === slot);
  let count = 0;
  for (const dose of plan?.waves.flatMap((w) => w.doses) ?? []) {
    if (!remaining.has(`${dose.item.id}:${dose.slot}`)) continue;
    logDose(dose.item.id, dose.slot, "taken", date);
    count += 1;
  }
  void clearDelivered(slot);
  return count;
}

export function AppFrame() {
  const hydrated = useSupplime((s) => s.hydrated);
  const onboarded = useSupplime((s) => s.profile.onboarded);
  const tab = useNav((s) => s.tab);
  const [addOpen, setAddOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Bumps every minute and whenever the app returns to the foreground, so "due now",
  // today's date, and the reminder schedule never go stale.
  const [now, setNow] = useState(() => Date.now());

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
    const openAdd = () => setAddOpen(true);
    window.addEventListener("supplime:add", openAdd);
    return () => window.removeEventListener("supplime:add", openAdd);
  }, []);

  useEffect(() => {
    if (!isNative()) return;
    void setupNotifications({
      onTake: (date, slot) => {
        const n = takeWholeSlot(date, slot);
        if (n > 0) toast(`Logged ${n} dose${n === 1 ? "" : "s"}`);
        useNav.getState().go("today");
      },
      onOpen: () => useNav.getState().go("today"),
    });
    const resume = CapApp.addListener("resume", () => setNow(Date.now()));
    // Android back: close an open sheet first, then go back to Today, then leave the app.
    const back = CapApp.addListener("backButton", () => {
      if (document.querySelector('[role="dialog"]')) {
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
      <AppShell onOpenSettings={() => setSettingsOpen(true)}>
        {tab === "today" && <TodayView onAdd={openAddSheet} now={now} />}
        {tab === "stack" && <StackView onAdd={openAddSheet} />}
        {tab === "record" && <InsightsView />}
        {tab === "body" && <BodyView />}
      </AppShell>
      <AddSheet open={addOpen} onOpenChange={setAddOpen} />
      <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ReminderEngine now={now} />
      <Toaster position="top-center" richColors={false} />
    </>
  );
}

export function openAddSheet() {
  window.dispatchEvent(new Event("supplime:add"));
}
