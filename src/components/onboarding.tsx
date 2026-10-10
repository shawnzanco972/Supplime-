import { Wordmark } from "@/components/app-shell";
import { Clock, ShieldCheck, Watch, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Chip, HabitsForm, RhythmForm } from "@/components/fields";
import { ItemSetupForm, type SetupSeed } from "@/components/item-setup";
import { BrandBadge, ProductPicker, iconFor } from "@/components/product-picker";
import { AiSetupSteps } from "@/components/ai-setup";
import { HealthConnect } from "@/components/health-connect";
import { PrivacyScreen } from "@/components/privacy-screen";
import { enableNotifications } from "@/components/reminders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseSetup, type SetupImport } from "@/lib/ai-setup";
import { useNav } from "@/lib/nav";
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
  const [ai, setAi] = useState(false);
  const [intro, setIntro] = useState<"welcome" | "start">("welcome");
  const [taking, setTaking] = useState(true);
  const [privacy, setPrivacy] = useState(false);
  const today = logicalDate(new Date(), rhythm);

  /** Fill every step from an AI setup block; you still walk through and check each one. */
  const applySetup = (x: SetupImport) => {
    if (x.name) setName(x.name);
    if (x.why) setWhy(x.why);
    if (x.goals.length) setGoals(x.goals);
    setRhythm((r) => ({ ...r, ...x.rhythm }));
    setHabits((h) => ({ ...h, ...x.habits }));
    if (x.items.length) {
      setPicked((prev) => {
        const have = new Set(prev.map((p) => p.catalogId ?? p.name));
        return [...prev, ...x.items.filter((i) => !have.has(i.catalogId ?? i.name))];
      });
    }
    setAi(false);
    setStep(1);
    toast(
      `Filled in from your AI${x.items.length ? `: ${x.items.length} supplement${x.items.length === 1 ? "" : "s"}` : ""}`,
      {
        description: x.custom.length
          ? `No guide yet for ${x.custom.join(", ")}: added with your numbers. Check each step.`
          : "Check each step and change anything that's off.",
      },
    );
  };

  // The answer can also arrive by sharing it from the Claude / Gemini app to Supplime.
  const inbox = useNav((s) => s.inbox);
  useEffect(() => {
    if (!inbox) return;
    useNav.setState({ inbox: null });
    const parsed = parseSetup(inbox, today);
    if (parsed) applySetup(parsed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inbox]);

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

      {step === 0 && intro === "welcome" && !ai && (
        <Step title="Take the right things at the right time — and know if they work.">
          <p className="max-w-sm text-muted-foreground">
            A private journey for your supplements: reminders that fit your day, honest timelines
            for when each one should kick in, and a clear moment to decide keep, adjust or stop.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            <Feature icon={Clock} title="Fits your real day">
              Sleep in? Tap “I’m up” (or let your watch tell it) and only the morning moves. Meals
              set the windows, not the clock.
            </Feature>
            <Feature icon={Watch} title="Works with Fitbit and Google Health">
              Optional: sleep, heart rate and HRV come in through Health Connect, so you see what
              changes when you start something.
            </Feature>
            <Feature icon={ShieldCheck} title="Stays on your phone">
              No account, no cloud. Back it up whenever you like.
            </Feature>
          </ul>
          {nav(null, () => setIntro("start"), "Begin")}
        </Step>
      )}

      {step === 0 && intro === "start" && !ai && (
        <Step
          title="Already taking supplements?"
          hint="Either way works. You can add or change anything later."
        >
          <div className="space-y-2">
            <ChoiceCard
              title="Not yet"
              text="Set up your day, then pick something to start with."
              onClick={() => {
                setTaking(false);
                setStep(1);
              }}
            />
            <ChoiceCard
              title="Yes, I'll add them here"
              text="Pick the type, brand and bottle. About a minute each."
              onClick={() => {
                setTaking(true);
                setStep(1);
              }}
            />
          </div>
          <button
            type="button"
            className="mt-4 min-h-11 text-left text-sm text-muted-foreground"
            onClick={() => setAi(true)}
          >
            Taking a lot?{" "}
            <span className="underline underline-offset-2">Let your AI app ask you</span> instead.
            Optional, and you can do it later from Settings.
          </button>
          <div className="mt-auto pt-8">
            <Button variant="ghost" onClick={() => setIntro("welcome")}>
              Back
            </Button>
          </div>
        </Step>
      )}

      {ai && (
        <Step
          title="Let your AI ask you"
          hint="It asks about 4 short questions about your day and what you take, then writes a block for Supplime. You'll still check every step."
        >
          <AiSetupSteps today={today} submitLabel="Fill in my setup" onImport={applySetup} />
          <button
            type="button"
            className="mt-4 min-h-11 text-sm text-muted-foreground underline"
            onClick={() => setAi(false)}
          >
            Back
          </button>
        </Step>
      )}

      {step === 1 && !ai && (
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
          hint="A typical day is enough. Windows follow your day — “first meal” is whenever you first eat, even at 1 pm. If your mornings vary, turn on “My wake time changes a lot”: reminders wait for “I’m up” (or your watch), and a late start only moves the morning."
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

      {step === 4 && adding === null && !ai && (
        <Step
          title={taking ? "What are you taking now?" : "Anything to start with?"}
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
          {picked.length === 0 && taking && (
            <button
              type="button"
              className="mt-2 min-h-11 w-full text-sm text-muted-foreground underline"
              onClick={() => setAi(true)}
            >
              Or import them from your AI app
            </button>
          )}
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
          <div className="mt-4 rounded-2xl bg-card px-4 py-4 shadow-[var(--shadow-border)]">
            <p className="flex items-center gap-2 font-medium">
              <Watch className="size-4" /> Fitbit or Google Health (optional)
            </p>
            <p className="mt-1 mb-3 text-sm text-muted-foreground">
              Sleep, heart rate, HRV and steps from your watch, plus when you actually woke up.
              Read-only, and it stays on this phone. You can also do this later on the Body tab.
            </p>
            <HealthConnect />
          </div>
          <p className="mt-6 text-xs text-muted-foreground">
            Your data stays on this phone.{" "}
            <button type="button" className="underline" onClick={() => setPrivacy(true)}>
              Privacy policy
            </button>
            {privacy && <PrivacyScreen onClose={() => setPrivacy(false)} />}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
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

function ChoiceCard({
  title,
  text,
  onClick,
}: {
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl bg-card px-4 py-4 text-left shadow-[var(--shadow-border)] active:bg-secondary"
    >
      <p className="font-medium">{title}</p>
      <p className="mt-0.5 text-sm text-muted-foreground">{text}</p>
    </button>
  );
}

function Feature({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Clock;
  title: string;
  children: ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
        <Icon className="size-4" />
      </span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="text-muted-foreground">{children}</span>
      </span>
    </li>
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
