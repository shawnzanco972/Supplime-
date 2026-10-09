import { Wordmark } from "@/components/app-shell";
import { X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Chip, HabitsForm, RhythmForm } from "@/components/fields";
import { ItemSetupForm, type SetupSeed } from "@/components/item-setup";
import { BrandBadge, ProductPicker, iconFor } from "@/components/product-picker";
import { enableNotifications } from "@/components/reminders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATALOG_BY_ID } from "@/lib/catalog";
import { profileFor } from "@/lib/knowledge";
import { contentsLabel } from "@/lib/products";
import { defaultRhythm, logicalDate, slotTimesFromRhythm } from "@/lib/protocol";
import { defaultHabits, useSupplime, type NewItem } from "@/lib/store";
import { GOALS, type GoalId, type Habits, type Rhythm, type StackItem } from "@/lib/types";
import { cn, daysBetween } from "@/lib/utils";

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
  const [adding, setAdding] = useState<null | "pick" | SetupSeed>(null);
  const [notify, setNotify] = useState(false);
  const today = logicalDate(new Date(), rhythm);

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
        <Wordmark className="h-5" />
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

      {step === 4 && adding === null && (
        <Step
          title="What are you taking now?"
          hint="Find the type, then the brand and bottle — strength, ingredients and directions fill in. Tell Supplime since when, and your timeline starts on the right day."
        >
          {picked.length > 0 && (
            <div className="space-y-2">
              {picked.map((p, i) => (
                <PickedRow
                  key={i}
                  item={p}
                  today={today}
                  onRemove={() => setPicked((prev) => prev.filter((_, j) => j !== i))}
                />
              ))}
            </div>
          )}
          <Button
            variant={picked.length ? "outline" : "default"}
            className="mt-4 w-full"
            onClick={() => setAdding("pick")}
          >
            + {picked.length ? "Add another" : "Add a supplement"}
          </Button>
          {nav(
            3,
            () => setStep(5),
            picked.length ? `Continue with ${picked.length}` : "Skip for now",
          )}
        </Step>
      )}

      {step === 4 && adding === "pick" && (
        <Step title="Pick a type">
          <ProductPicker
            exclude={picked.map((p) => p.catalogId!).filter(Boolean)}
            onPick={(p) => setAdding(p.custom ? {} : p)}
          />
          <button
            type="button"
            className="mt-4 min-h-11 text-sm text-muted-foreground underline"
            onClick={() => setAdding(null)}
          >
            Back
          </button>
        </Step>
      )}

      {step === 4 && adding !== null && adding !== "pick" && (
        <Step title="Set it up">
          <ItemSetupForm
            seed={adding}
            today={today}
            times={slotTimesFromRhythm(rhythm)}
            submitLabel="Add"
            onSubmit={(item) => {
              setPicked((prev) => [...prev, item]);
              setAdding(null);
            }}
          />
          <button
            type="button"
            className="mt-2 min-h-11 text-sm text-muted-foreground underline"
            onClick={() => setAdding("pick")}
          >
            Back
          </button>
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
  onRemove,
}: {
  item: NewItem;
  today: string;
  onRemove: () => void;
}) {
  const cat = item.catalogId ? CATALOG_BY_ID[item.catalogId] : undefined;
  const Icon = iconFor(item.catalogId);
  const p = profileFor({
    catalogId: item.catalogId ?? null,
    slots: [],
    foodTiming: "any",
  } as unknown as StackItem);
  const day = item.startedAt && item.startedAt < today ? daysBetween(item.startedAt, today) + 1 : 1;
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-card p-3 shadow-[var(--shadow-border)]">
      {item.product ? (
        <BrandBadge brand={item.product.brand} />
      ) : (
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
          <Icon className="size-5" />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium">{cat?.name ?? item.name}</p>
        <p className="text-xs text-muted-foreground">
          {item.product
            ? contentsLabel(item.product.perUnit, item.units ?? 1, item.product.form)
            : `${item.amount ?? ""} ${item.unit ?? ""}`}
        </p>
        <p className="mt-0.5 text-xs text-primary">
          {item.planned
            ? "In your cabinet, not started"
            : day > 1
              ? `Day ${day} · `
              : "Starts today · "}
          {item.planned
            ? ""
            : p.kind === "acute" && p.minutes
              ? `felt in ${p.minutes.min}–${p.minutes.max} min`
              : `most feel it by day ${p.typicalDay}`}
        </p>
      </div>
      <button
        type="button"
        aria-label="Remove"
        onClick={onRemove}
        className="-mt-1 -mr-1 flex size-9 items-center justify-center rounded-lg text-muted-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
