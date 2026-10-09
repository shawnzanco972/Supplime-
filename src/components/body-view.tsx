import { ChevronDown } from "lucide-react";
import { useMemo, useState } from "react";
import {
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { Chip } from "@/components/fields";
import { HealthConnect } from "@/components/health-connect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { parseFitbitCsv } from "@/lib/fitbit";
import { appToday, useSupplime } from "@/lib/store";
import type { BodyLog } from "@/lib/types";
import { addDays, cn, formatClock, formatShortDate, todayKey } from "@/lib/utils";

type Metric = {
  key: keyof BodyLog;
  label: string;
  unit: string;
  /** Lower is better (resting heart rate). */
  lower?: boolean;
  fmt?: (v: number) => string;
  /** Your own ratings, not from the watch. */
  self?: boolean;
};

const METRICS: Metric[] = [
  { key: "sleepHours", label: "Sleep", unit: "h", fmt: (v) => v.toFixed(1) },
  { key: "deepMin", label: "Deep sleep", unit: " min" },
  { key: "remMin", label: "REM", unit: " min" },
  { key: "restingHr", label: "Resting HR", unit: " bpm", lower: true },
  { key: "hrv", label: "HRV", unit: " ms" },
  { key: "steps", label: "Steps", unit: "", fmt: (v) => Math.round(v).toLocaleString() },
  { key: "activeMin", label: "Active", unit: " min" },
  { key: "spo2", label: "SpO₂", unit: "%", fmt: (v) => v.toFixed(1) },
  { key: "energy", label: "Energy", unit: "/5", self: true, fmt: (v) => v.toFixed(1) },
  { key: "mood", label: "Mood", unit: "/5", self: true, fmt: (v) => v.toFixed(1) },
  { key: "focus", label: "Focus", unit: "/5", self: true, fmt: (v) => v.toFixed(1) },
];

const num = (b: BodyLog | undefined, k: keyof BodyLog) =>
  typeof b?.[k] === "number" ? (b[k] as number) : undefined;
const show = (m: Metric, v: number) => `${m.fmt ? m.fmt(v) : Math.round(v)}${m.unit}`;

export function BodyView() {
  const body = useSupplime((s) => s.body);
  const stack = useSupplime((s) => s.stack);
  const sync = useSupplime((s) => s.profile.healthSync);
  const today = appToday();
  const byDate = useMemo(() => new Map(body.map((b) => [b.date, b])), [body]);
  const available = METRICS.filter((m) => !m.self && body.some((b) => num(b, m.key) !== undefined));
  const [metricKey, setMetricKey] = useState<keyof BodyLog>("sleepHours");
  const metric = available.find((m) => m.key === metricKey) ?? available[0] ?? METRICS[0]!;

  // Latest synced value of each watch metric (sleep belongs to the morning you woke up).
  const latest = METRICS.filter((m) => !m.self)
    .map((m) => {
      for (let i = 0; i < 3; i++) {
        const d = addDays(today, -i);
        const v = num(byDate.get(d), m.key);
        if (v !== undefined) return { m, v, date: d };
      }
      return null;
    })
    .filter((x): x is NonNullable<typeof x> => !!x);

  const chart = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => {
        const date = addDays(today, i - 29);
        return { date, label: formatShortDate(date), v: num(byDate.get(date), metric.key) ?? null };
      }),
    [byDate, metric.key, today],
  );
  const from = chart[0]!.date;
  const markers = stack
    .flatMap((item) =>
      item.doseHistory.map((s, i) => ({
        date: i === 0 ? item.startedAt : s.date,
        text: i === 0 ? `${item.name} start` : `${item.name} ${s.amount}${s.unit}`,
      })),
    )
    .filter((m) => m.date >= from && m.date <= today);
  const avg = (a: string, b: string) => {
    const vals = chart.filter((c) => c.date >= a && c.date <= b && c.v !== null).map((c) => c.v!);
    return vals.length ? vals.reduce((x, y) => x + y, 0) / vals.length : null;
  };
  const last7 = avg(addDays(today, -6), today);
  const prev7 = avg(addDays(today, -13), addDays(today, -7));

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Sleep, heart and how you feel</p>
        <h1 className="font-display text-3xl tracking-tight">Body</h1>
      </header>

      <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
        <p className="mb-2 font-medium">Fitbit / Google Health</p>
        <HealthConnect />
      </section>

      {latest.length > 0 && (
        <section>
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="font-display text-xl tracking-tight">Latest from your watch</h2>
            {sync?.lastSync && (
              <p className="text-xs text-muted-foreground">
                synced {formatShortDate(todayKey(new Date(sync.lastSync)))}{" "}
                {formatClock(new Date(sync.lastSync).toTimeString().slice(0, 5))}
              </p>
            )}
          </div>
          <div className="grid grid-cols-3 gap-2">
            {latest.map(({ m, v, date }) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMetricKey(m.key)}
                className={cn(
                  "rounded-xl bg-card px-2 py-3 text-center shadow-[var(--shadow-border)]",
                  metric.key === m.key && "ring-2 ring-primary",
                )}
              >
                <p className="text-lg font-semibold tabular-nums">{show(m, v)}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  {m.label}
                  {date !== today ? ` · ${formatShortDate(date)}` : ""}
                </p>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Synced automatically. Nothing to type in for these.
          </p>
        </section>
      )}

      <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
        <div className="flex flex-wrap gap-1.5">
          <p className="mr-1 self-center text-xs font-medium text-muted-foreground">Vitals</p>
          {(available.length ? available : METRICS.slice(0, 1)).map((m) => (
            <Chip key={m.key} on={m.key === metric.key} onClick={() => setMetricKey(m.key)}>
              {m.label}
            </Chip>
          ))}
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-2">
          <p className="font-medium">{metric.label}, 30 days</p>
          {last7 !== null && (
            <p className="text-xs text-muted-foreground">
              7-day avg <span className="font-medium text-foreground">{show(metric, last7)}</span>
              {prev7 !== null && <Trend now={last7} before={prev7} metric={metric} />}
            </p>
          )}
        </div>
        <div className="mt-2 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chart} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10 }}
                interval={6}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip
                formatter={(v) => (typeof v === "number" ? show(metric, v) : v)}
                contentStyle={{
                  background: "#fbfaf6",
                  border: "1px solid #ddd6c8",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              {markers.map((m) => (
                <ReferenceLine
                  key={`${m.date}-${m.text}`}
                  x={formatShortDate(m.date)}
                  stroke="#b7791f"
                  strokeDasharray="3 3"
                />
              ))}
              <Line
                type="monotone"
                dataKey="v"
                name={metric.label}
                stroke="#3d5a4c"
                strokeWidth={2}
                dot={{ r: 2 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
        {markers.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Dashed lines: {markers.map((m) => `${m.text} (${formatShortDate(m.date)})`).join(" · ")}
          </p>
        )}
        {available.length === 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            Connect Fitbit / Google Health above to fill this in.
          </p>
        )}
      </section>

      <FeelSection today={today} body={body} existing={byDate.get(today)} />

      <ManualNumbers today={today} existing={byDate.get(today)} open={!sync?.enabled} />
    </div>
  );
}

function Trend({ now, before, metric }: { now: number; before: number; metric: Metric }) {
  const diff = now - before;
  if (Math.abs(diff) < 1e-9) return null;
  const better = metric.lower ? diff < 0 : diff > 0;
  return (
    <span className={cn("ml-1", better ? "text-primary" : "text-warn")}>
      {diff > 0 ? "▲" : "▼"} {metric.fmt ? metric.fmt(Math.abs(diff)) : Math.round(Math.abs(diff))}
      {metric.unit} vs week before
    </span>
  );
}

const FEEL = [
  { key: "energy", label: "Energy", color: "#3d5a4c" },
  { key: "mood", label: "Mood", color: "#b7791f" },
  { key: "focus", label: "Focus", color: "#6b7fa6" },
] as const;

/** How you feel, tracked on its own: today's rating and note, a 30-day chart, your notes. */
function FeelSection({
  today,
  body,
  existing,
}: {
  today: string;
  body: BodyLog[];
  existing?: BodyLog;
}) {
  const logBody = useSupplime((s) => s.logBody);
  const [energy, setEnergy] = useState(existing?.energy ?? 3);
  const [mood, setMood] = useState(existing?.mood ?? 3);
  const [focus, setFocus] = useState(existing?.focus ?? 3);
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const rated = body.filter((b) => typeof b.energy === "number" || typeof b.mood === "number");
  const chart = Array.from({ length: 30 }, (_, i) => {
    const date = addDays(today, i - 29);
    const b = rated.find((r) => r.date === date);
    return {
      label: formatShortDate(date),
      energy: b?.energy ?? null,
      mood: b?.mood ?? null,
      focus: b?.focus ?? null,
    };
  });
  const journal = [...body]
    .filter((b) => b.notes)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-display text-xl tracking-tight">How you feel</h2>
        <p className="text-sm text-muted-foreground">
          Your own read on the day, kept apart from the watch numbers.
        </p>
      </div>
      <div className="space-y-4 rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
        <p className="font-medium">{existing?.energy ? "Today (saved)" : "Today"}</p>
        <SliderRow label="Energy" value={energy} onChange={setEnergy} />
        <SliderRow label="Mood" value={mood} onChange={setMood} />
        <SliderRow label="Focus" value={focus} onChange={setFocus} />
        <div>
          <Label htmlFor="notes">Note of the day, or an affirmation</Label>
          <Textarea
            id="notes"
            className="mt-2"
            value={notes}
            placeholder="Why today felt like this… or something you want to remember."
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
        <Button
          className="w-full"
          onClick={() => {
            logBody({
              ...(existing ?? { source: "manual" }),
              date: today,
              energy,
              mood,
              focus,
              notes: notes.trim() || undefined,
            });
            toast(existing?.energy ? "Updated" : "Saved");
          }}
        >
          {existing?.energy ? "Update today" : "Save today"}
        </Button>
      </div>

      {rated.length > 0 && (
        <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
          <p className="font-medium">Energy, mood and focus, 30 days</p>
          <div className="mt-2 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chart} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10 }}
                  interval={6}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide domain={[1, 5]} />
                <Tooltip
                  contentStyle={{
                    background: "#fbfaf6",
                    border: "1px solid #ddd6c8",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                {FEEL.map((f) => (
                  <Line
                    key={f.key}
                    type="monotone"
                    dataKey={f.key}
                    name={f.label}
                    stroke={f.color}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-1 flex gap-3 text-xs text-muted-foreground">
            {FEEL.map((f) => (
              <span key={f.key} className="inline-flex items-center gap-1">
                <span className="size-2.5 rounded-full" style={{ background: f.color }} />
                {f.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {journal.length > 0 && (
        <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
          <p className="font-medium">Your notes</p>
          <ul className="mt-2 divide-y divide-border">
            {journal.map((b) => (
              <li key={b.date} className="py-2">
                <p className="text-xs text-muted-foreground">
                  {formatShortDate(b.date)}
                  {typeof b.energy === "number"
                    ? ` · energy ${b.energy} · mood ${b.mood ?? "–"} · focus ${b.focus ?? "–"}`
                    : ""}
                </p>
                <p className="mt-0.5 text-sm">{b.notes}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function ManualNumbers({
  today,
  existing,
  open: initiallyOpen,
}: {
  today: string;
  existing?: BodyLog;
  open: boolean;
}) {
  const logBody = useSupplime((s) => s.logBody);
  const importBody = useSupplime((s) => s.importBody);
  const [open, setOpen] = useState(initiallyOpen);
  const [v, setV] = useState({
    sleepHours: String(existing?.sleepHours ?? ""),
    restingHr: String(existing?.restingHr ?? ""),
    hrv: String(existing?.hrv ?? ""),
    steps: String(existing?.steps ?? ""),
  });
  return (
    <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left"
      >
        <span>
          <span className="block font-medium">No watch data? Enter it yourself</span>
          <span className="block text-xs text-muted-foreground">
            Only needed if you don't sync. Or import a Fitbit CSV.
          </span>
        </span>
        <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {(
              [
                ["sleepHours", "Sleep hours"],
                ["restingHr", "Resting HR"],
                ["hrv", "HRV"],
                ["steps", "Steps"],
              ] as const
            ).map(([k, label]) => (
              <div key={k}>
                <Label>{label}</Label>
                <Input
                  className="mt-2"
                  inputMode="decimal"
                  value={v[k]}
                  onChange={(e) => setV({ ...v, [k]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              logBody({
                ...(existing ?? { source: "manual" }),
                date: today,
                sleepHours: Number(v.sleepHours) || existing?.sleepHours,
                restingHr: Number(v.restingHr) || existing?.restingHr,
                hrv: Number(v.hrv) || existing?.hrv,
                steps: Number(v.steps) || existing?.steps,
              });
              toast("Saved");
            }}
          >
            Save numbers
          </Button>
          <label className="flex h-11 cursor-pointer items-center justify-center rounded-md bg-secondary text-sm font-medium">
            Import a Fitbit CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const rows = parseFitbitCsv(await file.text());
                if (rows.length === 0) {
                  toast.error("Couldn't read that CSV. Check it has a Date column.");
                  return;
                }
                importBody(rows);
                toast(`Imported ${rows.length} days`);
              }}
            />
          </label>
        </div>
      )}
    </section>
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
      <Slider min={1} max={5} step={1} value={[value]} onValueChange={(x) => onChange(x[0] ?? 3)} />
    </div>
  );
}
