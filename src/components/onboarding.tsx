import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CATALOG, catalogForGoals, searchCatalog } from "@/lib/catalog";
import { enableNotifications } from "@/components/reminders";
import { useSupplime } from "@/lib/store";
import { GOALS, type GoalId } from "@/lib/types";
import { cn } from "@/lib/utils";

const STARTER = ["lions-mane", "l-theanine", "magnesium", "vitamin-d"];

export function Onboarding() {
  const completeOnboarding = useSupplime((s) => s.completeOnboarding);
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [goals, setGoals] = useState<GoalId[]>(["focus", "sleep"]);
  const [picked, setPicked] = useState<string[]>(STARTER);
  const [query, setQuery] = useState("");
  const [notify, setNotify] = useState(false);

  const suggested = goals.length ? catalogForGoals(goals) : CATALOG;
  const results = query.trim() ? searchCatalog(query) : suggested;

  function toggleGoal(id: GoalId) {
    setGoals((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  }
  function toggleItem(id: string) {
    setPicked((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pt-[max(2.5rem,calc(env(safe-area-inset-top)+1.5rem))] pb-[max(2.5rem,calc(env(safe-area-inset-bottom)+1rem))] md:justify-center md:py-16">
      <p className="text-xs font-medium tracking-[0.18em] text-muted-foreground uppercase">
        Supplime
      </p>

      {step === 0 && (
        <div className="mt-10 flex flex-1 flex-col md:flex-none">
          <h1 className="font-display text-4xl leading-[1.1] tracking-tight">
            Take the right things at the right time.
          </h1>
          <p className="mt-4 max-w-sm text-muted-foreground">
            A private ritual for your stack — with food, on time, in stock, and honest about when
            something should start to work.
          </p>
          <div className="mt-auto pt-10 md:mt-10 md:pt-0">
            <Button className="w-full" size="lg" onClick={() => setStep(1)}>
              Begin
            </Button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="mt-8 flex flex-1 flex-col md:flex-none">
          <h1 className="font-display text-3xl tracking-tight">What are you building toward?</h1>
          <label className="mt-6 text-sm font-medium">Your name</label>
          <Input
            className="mt-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First name"
            autoComplete="given-name"
          />
          <div className="mt-6 flex flex-wrap gap-2">
            {GOALS.map((goal) => {
              const on = goals.includes(goal.id);
              return (
                <button
                  key={goal.id}
                  type="button"
                  onClick={() => toggleGoal(goal.id)}
                  className={cn(
                    "h-11 rounded-full px-4 text-sm font-medium transition-colors",
                    on
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground",
                  )}
                >
                  {goal.label}
                </button>
              );
            })}
          </div>
          <div className="mt-auto flex gap-3 pt-10 md:mt-10">
            <Button variant="ghost" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button className="flex-1" onClick={() => setStep(2)}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="mt-8 flex flex-1 flex-col">
          <h1 className="font-display text-3xl tracking-tight">What are you taking?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A starter protocol is selected. Toggle anything. You can add more later.
          </p>
          <Input
            className="mt-5"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Lion's Mane, theanine…"
          />
          <div className="mt-4 flex max-h-[50dvh] flex-col gap-2 overflow-y-auto">
            {results.slice(0, 12).map((item) => {
              const on = picked.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className={cn(
                    "rounded-xl px-4 py-3 text-left transition-colors",
                    on
                      ? "bg-primary text-primary-foreground"
                      : "bg-card shadow-[var(--shadow-border)]",
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-medium">{item.name}</span>
                    <span
                      className={cn(
                        "text-xs",
                        on ? "text-primary-foreground/80" : "text-muted-foreground",
                      )}
                    >
                      {item.typicalDose}
                    </span>
                  </div>
                  <p
                    className={cn(
                      "mt-1 text-sm",
                      on ? "text-primary-foreground/80" : "text-muted-foreground",
                    )}
                  >
                    {item.summary}
                  </p>
                </button>
              );
            })}
          </div>
          <div className="mt-4 flex gap-3">
            <Button variant="ghost" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button className="flex-1" onClick={() => setStep(3)}>
              {picked.length ? `Continue · ${picked.length}` : "Skip for now"}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="mt-8 flex flex-1 flex-col md:flex-none">
          <h1 className="font-display text-3xl tracking-tight">Stay on cadence.</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Supplime pings this phone when a window opens, even when the app is closed. Tap “Took
            them” on the notification and the doses are logged.
          </p>
          <button
            type="button"
            onClick={async () => {
              const ok = await enableNotifications();
              setNotify(ok);
            }}
            className={cn(
              "mt-8 rounded-xl px-4 py-4 text-left shadow-[var(--shadow-border)]",
              notify ? "bg-primary text-primary-foreground" : "bg-card",
            )}
          >
            <p className="font-medium">{notify ? "Reminders on" : "Enable reminders"}</p>
            <p
              className={cn(
                "mt-1 text-sm",
                notify ? "text-primary-foreground/80" : "text-muted-foreground",
              )}
            >
              One notification per meal window, grouped by what to take with food.
            </p>
          </button>
          <p className="mt-6 text-sm text-muted-foreground">
            Already taking something? Open it in Stack later and set “Started on” so the onset and
            dose-review clocks start from the right day.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Personal tracker, not medical advice. Timing windows are typical ranges, not promises.
          </p>
          <div className="mt-auto flex gap-3 pt-10 md:mt-10">
            <Button variant="ghost" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button
              className="flex-1"
              onClick={() =>
                completeOnboarding({
                  displayName: name,
                  goals,
                  catalogIds: picked,
                  notifications: notify,
                })
              }
            >
              Open my ritual
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
