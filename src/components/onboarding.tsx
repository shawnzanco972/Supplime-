import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Chip, HabitsForm, NumberInput, RhythmForm, StartedPicker } from "@/components/fields";
import { enableNotifications } from "@/components/reminders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATALOG, CATALOG_BY_ID, catalogForGoals, searchCatalog } from "@/lib/catalog";
import { profileFor } from "@/lib/knowledge";
import { defaultRhythm, logicalDate } from "@/lib/protocol";
import { defaultHabits, useSupplime, type NewItem } from "@/lib/store";
import { GOALS, type GoalId, type Habits, type Rhythm, type StackItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const WHY_IDEAS = [
  "Sharper focus at work",
  "Sleep deeper",
  "Calmer, steadier days",
  "More energy",
  "Feel good long term",
];
const STEPS = 6;

export function Onboarding() {
  const completeOnboarding = useSupplime((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [why, setWhy] = useState("");
  const [goals, setGoals] = useState<GoalId[]>([]);
  const [rhythm, setRhythm] = useState<Rhythm>(defaultRhythm());
  const [habits, setHabits] = useState<Habits>(defaultHabits());
  const [picked, setPicked] = useState<NewItem[]>([]);
  const [query, setQuery] = useState("");
  const [notify, setNotify] = useState(false);
  const today = logicalDate(new Date(), rhythm);

  const suggested = goals.length ? catalogForGoals(goals) : CATALOG;
  const results = (query.trim() ? searchCatalog(query) : suggested).filter(
    (c) => !picked.some((p) => p.catalogId === c.id),
  );

  const nav = (back: number | null, next: () => void, label = "Continue", disabled = false) => (
    <div className="mt-auto flex gap-3 pt-8">
      {back !== null && (
        <Button variant="ghost" onClick={() => setStep(back)}>
          Back
        </Button>
      )}
      <Button className="flex-1" size="lg" disabled={disabled} onClick={next}>
        {label}
      </Button>
    </div>
  );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pt-[max(2rem,calc(env(safe-area-inset-top)+1.5rem))] pb-[max(2rem,calc(env(safe-area-inset-bottom)+1rem))]">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
          Supplime
        </p>
        {step > 0 && (
          <div className="flex gap-1" aria-label={`Step ${step} of ${STEPS - 1}`}>
            {Array.from({ length: STEPS - 1 }, (_, i) => (
              <span
                key={i}
                className={cn("h-1.5 w-6 rounded-full", i < step ? "bg-primary" : "bg-muted")}
              />
            ))}
          </div>
        )}
      </div>

      {step === 0 && (
        <Step title="Take the right things at the right time — and know if they work.">
          <p className="max-w-sm text-muted-foreground">
            A private journey for your supplements: reminders that fit your day, honest timelines
            for when each one should kick in, and a clear moment to decide keep, adjust or stop.
          </p>
          {nav(null, () => setStep(1), "Begin")}
        </Step>
      )}

      {step === 1 && (
        <Step
          title="Why are you doing this?"
          hint="Your reason shows on Today. It's the thing that keeps a habit going."
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your first name"
            autoComplete="given-name"
          />
          <Input
            className="mt-3"
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            placeholder="e.g. Sharper focus at work"
          />
          <div className="mt-3 flex flex-wrap gap-2">
            {WHY_IDEAS.map((w) => (
              <Chip key={w} on={why === w} onClick={() => setWhy(w)}>
                {w}
              </Chip>
            ))}
          </div>
          <p className="mt-6 text-sm font-medium">Goals</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {GOALS.map((g) => (
              <Chip
                key={g.id}
                on={goals.includes(g.id)}
                onClick={() =>
                  setGoals((prev) =>
                    prev.includes(g.id) ? prev.filter((x) => x !== g.id) : [...prev, g.id],
                  )
                }
              >
                {g.label}
              </Chip>
            ))}
          </div>
          {nav(0, () => setStep(2))}
        </Step>
      )}

      {step === 2 && (
        <Step
          title="What does your day look like?"
          hint="Windows follow your day — “first meal” is whenever you first eat, even at 1 pm."
        >
          <RhythmForm value={rhythm} onChange={setRhythm} />
          {nav(1, () => setStep(3))}
        </Step>
      )}

      {step === 3 && (
        <Step
          title="A couple of habits"
          hint="Some supplements clash with coffee or alcohol. Supplime will flag those for you."
        >
          <HabitsForm value={habits} onChange={setHabits} />
          {nav(2, () => setStep(4))}
        </Step>
      )}

      {step === 4 && (
        <Step
          title="What are you taking now?"
          hint="Add what you already take and roughly since when. You can add iHerb products later from Stack."
        >
          {picked.length > 0 && (
            <div className="space-y-3">
              {picked.map((p) => (
                <PickedRow
                  key={p.catalogId!}
                  item={p}
                  today={today}
                  onChange={(next) =>
                    setPicked((prev) => prev.map((x) => (x.catalogId === p.catalogId ? next : x)))
                  }
                  onRemove={() =>
                    setPicked((prev) => prev.filter((x) => x.catalogId !== p.catalogId))
                  }
                />
              ))}
            </div>
          )}
          <Input
            className="mt-4"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search: Lion's Mane, theanine, melatonin…"
          />
          <div className="mt-3 flex max-h-[40dvh] flex-col gap-2 overflow-y-auto">
            {results.slice(0, 15).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setPicked((prev) => [
                    ...prev,
                    { catalogId: item.id, startedAt: today, amount: item.defaultAmount },
                  ]);
                  setQuery("");
                }}
                className="rounded-xl bg-card px-4 py-3 text-left shadow-[var(--shadow-border)]"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">+ {item.name}</span>
                  <span className="text-xs text-muted-foreground">{item.typicalDose}</span>
                </div>
              </button>
            ))}
          </div>
          {nav(
            3,
            () => setStep(5),
            picked.length ? `Continue with ${picked.length}` : "Skip for now",
          )}
        </Step>
      )}

      {step === 5 && (
        <Step
          title="Stay on cadence."
          hint="Supplime reminds you when a window opens, even with the app closed."
        >
          <button
            type="button"
            onClick={async () => setNotify(await enableNotifications())}
            className={cn(
              "rounded-2xl px-4 py-4 text-left shadow-[var(--shadow-border)]",
              notify ? "bg-primary text-primary-foreground" : "bg-card",
            )}
          >
            <p className="font-medium">{notify ? "Reminders on" : "Turn on reminders"}</p>
            <p
              className={cn(
                "mt-1 text-sm",
                notify ? "text-primary-foreground/80" : "text-muted-foreground",
              )}
            >
              From the notification: “Took them”, “In 1 hour”, or “Not with me” — and Supplime plans
              the catch-up.
            </p>
          </button>
          <p className="mt-6 text-xs text-muted-foreground">
            Personal tracker, not medical advice. Timelines are typical ranges, not promises.
          </p>
          {nav(
            4,
            () =>
              completeOnboarding({
                displayName: name,
                why,
                goals,
                rhythm,
                habits,
                items: picked,
                notifications: notify,
              }),
            "Start my journey",
          )}
        </Step>
      )}
    </div>
  );
}

function Step({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <div className="mt-8 flex flex-1 flex-col">
      <h1 className="font-display text-3xl leading-tight tracking-tight">{title}</h1>
      {hint && <p className="mt-2 text-sm text-muted-foreground">{hint}</p>}
      <div className="mt-6 flex flex-1 flex-col">{children}</div>
    </div>
  );
}

function PickedRow({
  item,
  today,
  onChange,
  onRemove,
}: {
  item: NewItem;
  today: string;
  onChange: (next: NewItem) => void;
  onRemove: () => void;
}) {
  const cat = CATALOG_BY_ID[item.catalogId!]!;
  const p = profileFor({ catalogId: cat.id } as StackItem);
  return (
    <div className="space-y-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{cat.name}</p>
          <p className="text-xs text-primary">
            {p.kind === "acute" && p.minutes
              ? `Felt in ${p.minutes.min}–${p.minutes.max} min`
              : `Usually felt around day ${p.typicalDay}`}{" "}
            · verdict day {p.evaluateDay}
          </p>
        </div>
        <button
          type="button"
          aria-label={`Remove ${cat.name}`}
          onClick={onRemove}
          className="-mt-1 -mr-1 flex size-9 items-center justify-center rounded-lg text-muted-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <NumberInput
          className="w-28"
          value={item.amount}
          onChange={(amount) => onChange({ ...item, amount })}
        />
        <span className="text-sm text-muted-foreground">{cat.unit} per dose</span>
      </div>
      <div>
        <p className="mb-2 text-xs text-muted-foreground">Taking it since</p>
        <StartedPicker
          value={item.startedAt ?? today}
          onChange={(startedAt) => onChange({ ...item, startedAt })}
          today={today}
        />
      </div>
    </div>
  );
}
