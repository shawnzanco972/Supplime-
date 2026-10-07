import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { connectHealth, healthAvailable, openHealthSettings, syncHealth } from "@/lib/health";
import { isNative } from "@/lib/platform";
import { useSupplime } from "@/lib/store";
import { formatShortDate, todayKey } from "@/lib/utils";

/** Connect / sync Health Connect (where Fitbit and Google Health share their data). */
export function HealthConnect() {
  const sync = useSupplime((s) => s.profile.healthSync);
  const setProfile = useSupplime((s) => s.setProfile);
  const [busy, setBusy] = useState(false);

  if (!isNative()) {
    return (
      <p className="text-sm text-muted-foreground">
        Available in the Android app. Here you can import a Fitbit CSV on the Body tab.
      </p>
    );
  }

  async function run(first: boolean) {
    setBusy(true);
    try {
      if (first) {
        const avail = await healthAvailable();
        if (!avail.ok) {
          toast.error("Health Connect isn't available", {
            description: "Install or update Health Connect, then try again.",
          });
          await openHealthSettings();
          return;
        }
        if (!(await connectHealth())) {
          toast.error("No access granted", {
            description: "Allow Supplime to read sleep, heart rate and HRV in Health Connect.",
          });
          return;
        }
      }
      const n = await syncHealth(first ? 45 : 14);
      toast(n ? `Synced ${n} days` : "Connected — no new data yet", {
        description: "In Google Health / Fitbit, make sure syncing to Health Connect is on.",
      });
    } catch (err) {
      toast.error("Sync failed", { description: String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {sync?.enabled ? (
        <>
          <p className="text-sm">
            Connected
            {sync.lastSync
              ? ` · last sync ${formatShortDate(todayKey(new Date(sync.lastSync)))}`
              : ""}
            . Syncs when you open the app.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={busy} onClick={() => run(false)}>
              {busy ? "Syncing…" : "Sync now"}
            </Button>
            <Button variant="ghost" onClick={() => setProfile({ healthSync: { enabled: false } })}>
              Disconnect
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">
            In Google Health (or the Fitbit app): Settings → Health Connect → allow it to share
            sleep, heart rate and HRV. Then connect here.
          </p>
          <Button disabled={busy} onClick={() => run(true)}>
            {busy ? "Connecting…" : "Connect Health Connect"}
          </Button>
        </>
      )}
    </div>
  );
}
