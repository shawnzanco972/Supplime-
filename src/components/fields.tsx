import { useEffect, useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { foodLabel } from "@/lib/catalog";
import { slotTimesFromRhythm } from "@/lib/protocol";
import {
  FOOD_TIMINGS,
  SLOTS,
  type FoodTiming,
  type Habits,
  type HabitRule,
  type MissedMode,
  type Rhythm,
  type SlotId,
  type SlotTimes,
} from "@/lib/types";
import { addDays, cn, formatClock, formatShortDate } from "@/lib/utils";

export function Chip({
  on,
  onClick,
  children,
  className,
}: {
  on: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "min-h-10 rounded-full px-3.5 text-sm font-medium transition-colors",
        on ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
  htmlFor,
}: {
  label: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div>
      <Label htmlFor={htmlFor}>{label}</Label>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-2">{children}</div>
    </div>
  );
}

export function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
      <div>
        <h3 className="font-display text-lg tracking-tight">{title}</h3>
        {hint && <p className="mt-0.5 text-sm text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** A number input that lets you clear it while typing. */
export function NumberInput({
  value,
  onChange,
  min = 0,
  step,
  id,
  className,
  placeholder,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  min?: number;
  step?: number;
  id?: string;
  className?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(value === undefined ? "" : String(value));
  useEffect(() => {
    setText((prev) => (Number(prev) === value ? prev : value === undefined ? "" : String(value)));
  }, [value]);
  return (
    <Input
      id={id}
      className={className}
      type="number"
      inputMode="decimal"
      step={step ?? "any"}
      min={min}
      placeholder={placeholder}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        if (e.target.value === "") return onChange(undefined);
        const n = Number(e.target.value.replace(",", "."));
        if (Number.isFinite(n) && n >= min) onChange(n);
      }}
    />
  );
}

export function TimeInput({
  value,
  onChange,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  id?: string;
}) {
  return (
    <Input
      id={id}
      type="time"
      className="w-32"
      value={value}
      onChange={(e) => e.target.value && onChange(e.target.value)}
    />
  );
}

export function SlotPicker({
  value,
  onChange,
  times,
}: {
  value: SlotId[];
  onChange: (v: SlotId[]) => void;
  times: SlotTimes;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {SLOTS.map((s) => {
        const on = value.includes(s.id);
        return (
          <button
            key={s.id}
            type="button"
            aria-pressed={on}
            onClick={() => {
              const next = on ? value.filter((x) => x !== s.id) : [...value, s.id];
              if (next.length) onChange(next);
            }}
            className={cn(
              "rounded-xl px-3 py-2 text-left transition-colors",
              on ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground",
            )}
          >
            <span className="block text-sm font-medium">{s.label}</span>
            <span
              className={cn(
                "block text-xs",
                on ? "text-primary-foreground/80" : "text-muted-foreground",
              )}
            >
              {formatClock(times[s.id])}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function FoodPicker({
  value,
  onChange,
}: {
  value: FoodTiming;
  onChange: (v: FoodTiming) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {FOOD_TIMINGS.map((t) => (
        <Chip key={t} on={value === t} onClick={() => onChange(t)}>
          {foodLabel(t)}
        </Chip>
      ))}
    </div>
  );
}

/** "When did you start?" with quick picks for things you already take. */
export function StartedPicker({
  value,
  onChange,
  today,
}: {
  value: string;
  onChange: (v: string) => void;
  today: string;
}) {
  const picks = [
    { label: "Today", days: 0 },
    { label: "1 week ago", days: 7 },
    { label: "2 weeks", days: 14 },
    { label: "1 month", days: 30 },
    { label: "3 months", days: 90 },
  ];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {picks.map((p) => {
          const date = addDays(today, -p.days);
          return (
            <Chip key={p.label} on={value === date} onClick={() => onChange(date)}>
              {p.label}
            </Chip>
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="date"
          className="w-44"
          max={today}
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
        />
        {value !== today && (
          <span className="text-xs text-muted-foreground">since {formatShortDate(value)}</span>
        )}
      </div>
    </div>
  );
}

const ONSET_PRESETS = [
  { label: "Same day", first: 1, typical: 3, evaluate: 14 },
  { label: "1–2 weeks", first: 5, typical: 10, evaluate: 28 },
  { label: "3–4 weeks", first: 10, typical: 24, evaluate: 56 },
  { label: "6–8 weeks", first: 21, typical: 49, evaluate: 84 },
  { label: "~3 months", first: 30, typical: 70, evaluate: 112 },
];

export type TimelineValue = {
  firstSignsDay: number;
  typicalDay: number;
  minDaysBeforeIncrease: number;
  evaluateDay: number;
};

/** The "how long" numbers: until it works, before changing the dose, and verdict day. */
export function TimelineFields({
  value,
  onChange,
}: {
  value: TimelineValue;
  onChange: (v: TimelineValue) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">How long until people feel it?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {ONSET_PRESETS.map((p) => (
            <Chip
              key={p.label}
              on={value.typicalDay === p.typical && value.firstSignsDay === p.first}
              onClick={() =>
                onChange({
                  ...value,
                  firstSignsDay: p.first,
                  typicalDay: p.typical,
                  evaluateDay: p.evaluate,
                  minDaysBeforeIncrease: Math.max(7, Math.min(28, Math.round(p.typical * 0.7))),
                })
              }
            >
              {p.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <DayField
          label="First signs from day"
          value={value.firstSignsDay}
          onChange={(n) => onChange({ ...value, firstSignsDay: n })}
        />
        <DayField
          label="Most feel it by day"
          value={value.typicalDay}
          onChange={(n) => onChange({ ...value, typicalDay: n })}
        />
        <DayField
          label="Min. days before changing dose"
          value={value.minDaysBeforeIncrease}
          onChange={(n) => onChange({ ...value, minDaysBeforeIncrease: n })}
        />
        <DayField
          label="Verdict on day"
          value={value.evaluateDay}
          onChange={(n) => onChange({ ...value, evaluateDay: n })}
        />
      </div>
    </div>
  );
}

function DayField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div>
      <Label className="text-xs leading-tight">{label}</Label>
      <NumberInput
        className="mt-1.5"
        min={1}
        step={1}
        value={value}
        onChange={(n) => n && onChange(Math.round(n))}
      />
    </div>
  );
}

const RULE_TOGGLES: { kind: HabitRule["kind"]; label: string; text: string; hours?: number }[] = [
  { kind: "needs-food", label: "Needs food", text: "Take with food" },
  { kind: "empty-stomach", label: "Empty stomach", text: "Empty stomach, 20–30 min before food" },
  { kind: "avoid-caffeine", label: "Avoid coffee", text: "Keep away from coffee", hours: 1 },
  { kind: "pairs-caffeine", label: "Good with coffee", text: "Pairs well with coffee" },
  { kind: "avoid-alcohol", label: "Avoid alcohol", text: "Keep away from alcohol", hours: 4 },
  { kind: "stimulating", label: "Stimulating", text: "Morning or early afternoon only" },
  { kind: "drowsy", label: "Makes me drowsy", text: "Best in the evening" },
];

export function RulesEditor({
  value,
  onChange,
}: {
  value: HabitRule[];
  onChange: (v: HabitRule[]) => void;
}) {
  const has = (k: HabitRule["kind"]) => value.find((r) => r.kind === k);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {RULE_TOGGLES.map((t) => (
          <Chip
            key={t.kind}
            on={!!has(t.kind)}
            onClick={() =>
              onChange(
                has(t.kind)
                  ? value.filter((r) => r.kind !== t.kind)
                  : [...value, { kind: t.kind, text: t.text, hours: t.hours }],
              )
            }
          >
            {t.label}
          </Chip>
        ))}
      </div>
      {value
        .filter((r) => r.kind === "avoid-alcohol" || r.kind === "avoid-caffeine")
        .map((r) => (
          <div key={r.kind} className="flex items-center justify-between gap-3">
            <Label>
              {r.kind === "avoid-alcohol" ? "Hours away from alcohol" : "Hours away from coffee"}
            </Label>
            <NumberInput
              className="w-24"
              min={0}
              step={1}
              value={r.hours}
              onChange={(n) =>
                onChange(value.map((x) => (x.kind === r.kind ? { ...x, hours: n ?? 0 } : x)))
              }
            />
          </div>
        ))}
      {value.some((r) => r.kind === "separate") && (
        <p className="text-xs text-muted-foreground">
          {value
            .filter((r) => r.kind === "separate")
            .map((r) => r.text)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}

export const MISSED_COPY: Record<MissedMode, { label: string; detail: string }> = {
  "catch-up": { label: "Catch up later", detail: "A late dose the same day still counts." },
  "morning-only": { label: "Morning only", detail: "Catch up only until early afternoon." },
  "bedtime-only": { label: "Bedtime only", detail: "Skip if you miss bedtime." },
  optional: { label: "Only when needed", detail: "No catch-up; take it when you want the effect." },
};

export function MissedPicker({
  value,
  onChange,
}: {
  value: MissedMode;
  onChange: (v: MissedMode) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {(Object.keys(MISSED_COPY) as MissedMode[]).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={cn(
            "rounded-xl px-3 py-2 text-left",
            value === m
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-secondary-foreground",
          )}
        >
          <span className="block text-sm font-medium">{MISSED_COPY[m].label}</span>
          <span
            className={cn(
              "block text-xs",
              value === m ? "text-primary-foreground/80" : "text-muted-foreground",
            )}
          >
            {MISSED_COPY[m].detail}
          </span>
        </button>
      ))}
    </div>
  );
}

/** Your day: wake, meals, bed, home. Shows the windows it creates. */
export function RhythmForm({ value, onChange }: { value: Rhythm; onChange: (v: Rhythm) => void }) {
  const set = (patch: Partial<Rhythm>) => onChange({ ...value, ...patch });
  const preview = slotTimesFromRhythm(value);
  return (
    <div className="space-y-4">
      <Row label="I usually wake up at">
        <TimeInput value={value.wake} onChange={(wake) => set({ wake })} />
      </Row>
      <div>
        <p className="text-sm font-medium">Breakfast?</p>
        <div className="mt-2 flex gap-2">
          <Chip on={value.eatsBreakfast} onClick={() => set({ eatsBreakfast: true })}>
            I eat soon after waking
          </Chip>
          <Chip on={!value.eatsBreakfast} onClick={() => set({ eatsBreakfast: false })}>
            I eat later
          </Chip>
        </div>
      </div>
      <Row label={value.eatsBreakfast ? "Breakfast at" : "First meal at"}>
        <TimeInput value={value.firstMeal} onChange={(firstMeal) => set({ firstMeal })} />
      </Row>
      <Row label="Last meal at">
        <TimeInput value={value.lastMeal} onChange={(lastMeal) => set({ lastMeal })} />
      </Row>
      <Row label="Bedtime">
        <TimeInput value={value.bed} onChange={(bed) => set({ bed })} />
      </Row>
      <Row label="Usually home by" hint="For catch-ups when a pill isn't with you.">
        <TimeInput value={value.home} onChange={(home) => set({ home })} />
      </Row>
      <div className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-3 py-3">
        <div>
          <Label htmlFor="flex-wake">My wake time changes a lot</Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Morning reminders wait until you tap “I'm up”, and your morning windows move with you.
          </p>
        </div>
        <Switch
          id="flex-wake"
          checked={value.flexibleWake}
          onCheckedChange={(flexibleWake) => set({ flexibleWake })}
        />
      </div>
      <div className="rounded-xl bg-accent/60 px-3 py-3 text-sm">
        <p className="font-medium text-accent-foreground">Your windows</p>
        <ul className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs text-accent-foreground/90">
          {SLOTS.map((s) => (
            <li key={s.id} className="flex justify-between gap-2">
              <span>{s.label}</span>
              <span className="tabular-nums">{formatClock(preview[s.id])}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function HabitsForm({ value, onChange }: { value: Habits; onChange: (v: Habits) => void }) {
  const set = (patch: Partial<Habits>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium">Coffee?</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Chip on={value.coffee} onClick={() => set({ coffee: true })}>
            Yes
          </Chip>
          <Chip on={!value.coffee} onClick={() => set({ coffee: false })}>
            No
          </Chip>
          {value.coffee && (
            <span className="ml-2 flex items-center gap-2 text-sm">
              usually at{" "}
              <TimeInput value={value.coffeeTime} onChange={(coffeeTime) => set({ coffeeTime })} />
            </span>
          )}
        </div>
      </div>
      <div>
        <p className="text-sm font-medium">Alcohol?</p>
        <div className="mt-2 flex gap-2">
          {(["never", "sometimes", "often"] as const).map((a) => (
            <Chip key={a} on={value.alcohol === a} onClick={() => set({ alcohol: a })}>
              {a[0]!.toUpperCase() + a.slice(1)}
            </Chip>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </div>
  );
}
