import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Chip,
  Field,
  HabitsForm,
  ReorderLeadPicker,
  RhythmForm,
  Section,
  TimeInput,
} from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Confirm, Screen } from "@/components/ui/screen";
import { Switch } from "@/components/ui/switch";
import { exportBackup, importBackup } from "@/lib/backup";
import { DEFAULT_COACH_MODEL, DEFAULT_GEMINI_MODEL } from "@/lib/coach";
import { HealthConnect } from "@/components/health-connect";
import { useNav } from "@/lib/nav";
import {
  exactAlarmsAllowed,
  feelReminder,
  openExactAlarmSettings,
  requestNotificationPermission,
  syncReminders,
} from "@/lib/notifications";
import { isNative } from "@/lib/platform";
import { useSupplime } from "@/lib/store";
import { SLOTS } from "@/lib/types";

const LEAD_OPTIONS = [0, 5, 10, 15, 30];
const NAG_OPTIONS = [0, 15, 30, 60];
const TARGETS = [0.7, 0.8, 0.85, 0.9, 1];

export function SettingsScreen() {
  const close = useNav((s) => s.close);
  const profile = useSupplime((s) => s.profile);
  const feel = feelReminder(profile);
  const setNotifications = useSupplime((s) => s.setNotifications);
  const setSlotTime = useSupplime((s) => s.setSlotTime);
  const setProfile = useSupplime((s) => s.setProfile);
  const setRhythm = useSupplime((s) => s.setRhythm);
  const resetAll = useSupplime((s) => s.resetAll);
  const setReorderLead = useSupplime((s) => s.setReorderLead);
  const [exact, setExact] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const [fineTune, setFineTune] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void exactAlarmsAllowed().then(setExact);
  }, []);

  return (
    <Screen onClose={close} title="Settings" subtitle={`Supplime ${__APP_VERSION__}`}>
      <div className="space-y-4">
        <Section title="You">
          <Input
            value={profile.displayName}
            onChange={(e) => setProfile({ displayName: e.target.value })}
            placeholder="Your name"
          />
          <Input
            value={profile.why}
            onChange={(e) => setProfile({ why: e.target.value })}
            placeholder="Why you're doing this"
          />
        </Section>

        <Section
          title="Your day"
          hint="Changing this moves your windows. Fine-tune single windows below."
        >
          <RhythmForm value={profile.rhythm} onChange={setRhythm} />
          <button
            type="button"
            className="text-sm underline"
            onClick={() => setFineTune((v) => !v)}
          >
            {fineTune ? "Hide" : "Fine-tune"} single windows
          </button>
          {fineTune && (
            <div className="space-y-2">
              {SLOTS.map((slot) => (
                <div key={slot.id} className="flex items-center justify-between gap-3">
                  <Label htmlFor={`time-${slot.id}`}>{slot.label}</Label>
                  <TimeInput
                    id={`time-${slot.id}`}
                    value={profile.slotTimes[slot.id]}
                    onChange={(t) => setSlotTime(slot.id, t)}
                  />
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Habits">
          <HabitsForm value={profile.habits} onChange={(habits) => setProfile({ habits })} />
        </Section>

        <Section
          title="Reorder reminders"
          hint="How early to warn you before a bottle runs out — leave time for shipping."
        >
          <ReorderLeadPicker value={profile.reorderLeadDays} onChange={setReorderLead} />
        </Section>

        <Section
          title="Weekly target"
          hint="Share of planned doses you aim for. Hitting it earns +75 XP."
        >
          <div className="flex flex-wrap gap-2">
            {TARGETS.map((t) => (
              <Chip
                key={t}
                on={profile.weeklyTarget === t}
                onClick={() => setProfile({ weeklyTarget: t })}
              >
                {Math.round(t * 100)}%
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Reminders">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="notes-on">Notifications</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                {isNative()
                  ? "Even when Supplime is closed, with Took them / In 1 hour / Not with me."
                  : "Fires while this tab is open."}
              </p>
            </div>
            <Switch
              id="notes-on"
              checked={profile.notifications}
              onCheckedChange={async (on) => {
                if (on) {
                  const ok = await requestNotificationPermission();
                  setNotifications(ok);
                  if (!ok)
                    toast.error("Notifications are blocked. Allow them in Android settings.");
                } else setNotifications(false);
              }}
            />
          </div>
          {profile.notifications && isNative() && !exact && (
            <div className="rounded-xl bg-secondary p-3 text-sm">
              <p>
                Android may delay reminders by a few minutes unless Supplime may use exact alarms.
              </p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={async () => {
                  await openExactAlarmSettings();
                  setExact(await exactAlarmsAllowed());
                  void syncReminders();
                }}
              >
                Allow exact timing
              </Button>
            </div>
          )}
          <div>
            <p className="text-sm font-medium">Remind me</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {LEAD_OPTIONS.map((n) => (
                <Chip
                  key={n}
                  on={profile.reminderLeadMinutes === n}
                  onClick={() => setProfile({ reminderLeadMinutes: n })}
                >
                  {n === 0 ? "On time" : `${n} min early`}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-medium">Nudge again if not logged</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {NAG_OPTIONS.map((n) => (
                <Chip
                  key={n}
                  on={profile.nagMinutes === n}
                  onClick={() => setProfile({ nagMinutes: n })}
                >
                  {n === 0 ? "Off" : `after ${n} min`}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="feel">Evening check-in</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                "How was your day?": energy, mood, focus and a note.
              </p>
            </div>
            <Switch
              id="feel"
              checked={feel.enabled}
              onCheckedChange={(enabled) =>
                setProfile({ feelReminder: { ...profile.feelReminder, enabled } })
              }
            />
          </div>
          {feel.enabled && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">At</span>
              <TimeInput
                value={feel.time}
                onChange={(time) => setProfile({ feelReminder: { enabled: true, time } })}
              />
            </div>
          )}
        </Section>

        <Section
          title="Backup"
          hint="Everything stays on this phone. Export now and then, and always before changing phones."
        >
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={async () => {
                try {
                  await exportBackup();
                } catch (err) {
                  if (!String(err).toLowerCase().includes("cancel"))
                    toast.error("Could not export the backup.");
                }
              }}
            >
              Export
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => fileRef.current?.click()}>
              Restore
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                if (await importBackup(file)) {
                  toast("Backup restored");
                  close();
                } else toast.error("That file isn't a Supplime backup.");
              }}
            />
          </div>
        </Section>

        <Section
          title="Coach"
          hint="By default the coach sends a briefing to your Claude or Gemini app (free with your subscription). API keys are optional, stored only on this phone and never put in backups."
        >
          <Field label="Gemini API key (free tier)" hint="From aistudio.google.com → Get API key.">
            <Input
              type="password"
              autoComplete="off"
              placeholder="AIza…"
              value={profile.geminiKey ?? ""}
              onChange={(e) =>
                setProfile({
                  geminiKey: e.target.value.trim() || undefined,
                  coachProvider: e.target.value.trim() ? "gemini" : profile.coachProvider,
                })
              }
            />
          </Field>
          <Field label="xAI (Grok) key">
            <Input
              type="password"
              autoComplete="off"
              placeholder="xai-…"
              value={profile.coachKey ?? ""}
              onChange={(e) => setProfile({ coachKey: e.target.value.trim() || undefined })}
            />
          </Field>
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="coach-model">Model (optional)</Label>
            <Input
              id="coach-model"
              className="w-44"
              placeholder={
                profile.coachProvider === "xai" ? DEFAULT_COACH_MODEL : DEFAULT_GEMINI_MODEL
              }
              value={profile.coachModel ?? ""}
              onChange={(e) => setProfile({ coachModel: e.target.value.trim() || undefined })}
            />
          </div>
        </Section>

        <Section
          title="Fitbit / Google Health"
          hint="Reads sleep, resting heart rate, HRV and steps through Health Connect. Nothing leaves your phone."
        >
          <HealthConnect />
        </Section>

        <Button
          variant="ghost"
          className="w-full text-destructive"
          onClick={() => setConfirmReset(true)}
        >
          Erase everything on this phone
        </Button>
      </div>
      <Confirm
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Erase everything?"
        body="Your stack, history, journey and settings are deleted from this phone. Export a backup first if you might want them back."
        confirmLabel="Erase"
        onConfirm={() => {
          resetAll();
          close();
        }}
      />
    </Screen>
  );
}
