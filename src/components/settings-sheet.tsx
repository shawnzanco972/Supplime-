import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { exportBackup, importBackup } from "@/lib/backup";
import { DEFAULT_COACH_MODEL } from "@/lib/coach";
import {
  exactAlarmsAllowed,
  openExactAlarmSettings,
  requestNotificationPermission,
  syncReminders,
} from "@/lib/notifications";
import { isNative } from "@/lib/platform";
import { useSupplime } from "@/lib/store";
import { SLOTS } from "@/lib/types";
import { cn } from "@/lib/utils";

const LEAD_OPTIONS = [0, 5, 10, 15, 30];
const NAG_OPTIONS = [0, 15, 30, 60];

export function SettingsSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const profile = useSupplime((s) => s.profile);
  const setNotifications = useSupplime((s) => s.setNotifications);
  const setSlotTime = useSupplime((s) => s.setSlotTime);
  const setProfile = useSupplime((s) => s.setProfile);
  const resetAll = useSupplime((s) => s.resetAll);
  const [exact, setExact] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setConfirmReset(false);
      return;
    }
    void exactAlarmsAllowed().then(setExact);
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Reminders, meal times, backups and the coach.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <Label htmlFor="notes-on">Reminders</Label>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isNative()
                    ? "Android notifications, even when Supplime is closed. Tap “Took them” right from the notification."
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
                    else toast("Reminders on");
                  } else setNotifications(false);
                }}
              />
            </div>

            {profile.notifications && isNative() && !exact && (
              <div className="rounded-lg bg-secondary p-3 text-sm">
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

            <ChoiceRow
              label="Remind me"
              options={LEAD_OPTIONS}
              value={profile.reminderLeadMinutes}
              format={(n) => (n === 0 ? "On time" : `${n} min early`)}
              onChange={(n) => setProfile({ reminderLeadMinutes: n })}
            />
            <ChoiceRow
              label="Nudge again if not logged"
              options={NAG_OPTIONS}
              value={profile.nagMinutes}
              format={(n) => (n === 0 ? "Off" : `${n} min`)}
              onChange={(n) => setProfile({ nagMinutes: n })}
            />
          </section>

          <section>
            <p className="text-sm font-medium">Window times</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Set these to when you actually eat.
            </p>
            <div className="mt-2 space-y-2">
              {SLOTS.map((slot) => (
                <div key={slot.id} className="flex items-center justify-between gap-3">
                  <Label htmlFor={`time-${slot.id}`}>{slot.label}</Label>
                  <Input
                    id={`time-${slot.id}`}
                    type="time"
                    className="w-32"
                    value={profile.slotTimes[slot.id]}
                    onChange={(e) => e.target.value && setSlotTime(slot.id, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg bg-secondary p-3">
            <p className="font-medium">Backup</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Everything stays on this phone. Save a backup to Drive or email now and then, and
              always before switching phones or reinstalling.
            </p>
            <div className="mt-3 flex gap-2">
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
                  const ok = await importBackup(file);
                  if (ok) {
                    toast("Backup restored");
                    onOpenChange(false);
                  } else toast.error("That file isn't a Supplime backup.");
                }}
              />
            </div>
          </section>

          <section className="space-y-3">
            <div>
              <p className="text-sm font-medium">Coach (optional)</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Your own xAI API key from console.x.ai. It is stored only on this phone and is never
                written into backups.
              </p>
            </div>
            <Input
              type="password"
              autoComplete="off"
              placeholder="xai-…"
              value={profile.coachKey ?? ""}
              onChange={(e) => setProfile({ coachKey: e.target.value.trim() || undefined })}
            />
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="coach-model">Model</Label>
              <Input
                id="coach-model"
                className="w-40"
                placeholder={DEFAULT_COACH_MODEL}
                value={profile.coachModel ?? ""}
                onChange={(e) => setProfile({ coachModel: e.target.value.trim() || undefined })}
              />
            </div>
          </section>

          <Button
            variant="ghost"
            className="w-full text-destructive"
            onClick={() => {
              if (!confirmReset) {
                setConfirmReset(true);
                return;
              }
              resetAll();
              onOpenChange(false);
            }}
          >
            {confirmReset ? "Tap again: erase everything on this phone" : "Reset this device"}
          </Button>
          <p className="text-center text-xs text-muted-foreground">Supplime {__APP_VERSION__}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChoiceRow({
  label,
  options,
  value,
  format,
  onChange,
}: {
  label: string;
  options: number[];
  value: number;
  format: (n: number) => string;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "h-10 rounded-full px-3 text-xs font-medium",
              value === n ? "bg-primary text-primary-foreground" : "bg-secondary",
            )}
          >
            {format(n)}
          </button>
        ))}
      </div>
    </div>
  );
}
