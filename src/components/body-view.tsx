import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { HealthConnect } from "@/components/health-connect";
import { parseFitbitCsv } from "@/lib/fitbit";
import { bodyAverages, dayAdherence } from "@/lib/stats";
import { appToday, useSupplime } from "@/lib/store";
import { addDays, formatShortDate } from "@/lib/utils";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function BodyView() {
  const body = useSupplime((s) => s.body);
  const stack = useSupplime((s) => s.stack);
  const logs = useSupplime((s) => s.logs);
  const logBody = useSupplime((s) => s.logBody);
  const importBody = useSupplime((s) => s.importBody);
  const today = appToday();
  const existing = body.find((b) => b.date === today);
  const [sleepHours, setSleepHours] = useState(String(existing?.sleepHours ?? "7.5"));
  const [sleepScore, setSleepScore] = useState(String(existing?.sleepScore ?? ""));
  const [restingHr, setRestingHr] = useState(String(existing?.restingHr ?? ""));
  const [hrv, setHrv] = useState(String(existing?.hrv ?? ""));
  const [steps, setSteps] = useState(String(existing?.steps ?? ""));
  const [energy, setEnergy] = useState(existing?.energy ?? 3);
  const [mood, setMood] = useState(existing?.mood ?? 3);
  const [focus, setFocus] = useState(existing?.focus ?? 3);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const avgs = bodyAverages(body, 7, today);

  const chart = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const date = addDays(addDays(today, -13), i);
      const row = body.find((b) => b.date === date);
      const adh = dayAdherence(stack, logs, date);
      return {
        date: formatShortDate(date),
        sleep: row?.sleepHours ?? null,
        rhr: row?.restingHr ?? null,
        taken: adh.scheduled ? Math.round(adh.rate * 10) / 10 : null,
      };
    });
  }, [body, logs, stack, today]);

  function save() {
    logBody({
      date: today,
      sleepHours: Number(sleepHours) || undefined,
      sleepScore: Number(sleepScore) || undefined,
      restingHr: Number(restingHr) || undefined,
      hrv: Number(hrv) || undefined,
      steps: Number(steps) || undefined,
      energy,
      mood,
      focus,
      notes: notes.trim() || undefined,
      source: existing?.source === "fitbit" ? "fitbit" : "manual",
    });
    toast("Body log saved");
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Sleep, heart and how you feel</p>
        <h1 className="font-display text-3xl tracking-tight">Body</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Supplime puts these next to each supplement's start date, so you can see whether sleep,
          resting heart rate or HRV moved after you began.
        </p>
      </header>

      <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
        <p className="mb-2 font-medium">Fitbit Air / Google Health</p>
        <HealthConnect />
      </section>

      <section className="grid grid-cols-3 gap-2">
        <Mini label="Sleep" value={avgs.sleepHours ? `${avgs.sleepHours.toFixed(1)}h` : "—"} />
        <Mini label="RHR" value={avgs.restingHr ? `${Math.round(avgs.restingHr)}` : "—"} />
        <Mini label="HRV" value={avgs.hrv ? `${Math.round(avgs.hrv)}` : "—"} />
      </section>

      <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
        <p className="text-sm font-medium">Sleep, 14 days</p>
        <div className="mt-3 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                interval={2}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{
                  background: "#fbfaf6",
                  border: "1px solid #ddd6c8",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Line
                type="monotone"
                dataKey="sleep"
                stroke="#3d5a4c"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="space-y-4 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
        <p className="font-medium">Today from Fitbit</p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sleep hours" value={sleepHours} onChange={setSleepHours} />
          <Field label="Sleep score" value={sleepScore} onChange={setSleepScore} />
          <Field label="Resting HR" value={restingHr} onChange={setRestingHr} />
          <Field label="HRV" value={hrv} onChange={setHrv} />
          <Field label="Steps" value={steps} onChange={setSteps} />
        </div>
        <SliderRow label="Energy" value={energy} onChange={setEnergy} />
        <SliderRow label="Mood" value={mood} onChange={setMood} />
        <SliderRow label="Focus" value={focus} onChange={setFocus} />
        <div>
          <Label htmlFor="notes">Note</Label>
          <Textarea
            id="notes"
            className="mt-2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <Button className="w-full" onClick={save}>
          Save today's signals
        </Button>
      </section>

      <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
        <p className="font-medium">Import a Fitbit CSV</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Sleep or RHR export. We read Date, Minutes Asleep, Sleep Score, Resting Heart Rate, HRV,
          Steps.
        </p>
        <label className="mt-3 flex h-11 cursor-pointer items-center justify-center rounded-md bg-secondary text-sm font-medium">
          Choose CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              const rows = parseFitbitCsv(text);
              if (rows.length === 0) {
                toast.error("Couldn't read that CSV. Check it has a Date column.");
                return;
              }
              importBody(rows);
              toast(`Imported ${rows.length} days`);
            }}
          />
        </label>
      </section>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card px-3 py-4 text-center shadow-[var(--shadow-border)]">
      <p className="font-display text-2xl tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        className="mt-2"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function SliderRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between text-sm">
        <Label>{label}</Label>
        <span className="tabular-nums text-muted-foreground">{value}/5</span>
      </div>
      <Slider min={1} max={5} step={1} value={[value]} onValueChange={(v) => onChange(v[0] ?? 3)} />
    </div>
  );
}
