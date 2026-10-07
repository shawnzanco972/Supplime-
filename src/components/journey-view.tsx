import { Lock, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Chip } from "@/components/fields";
import { VERDICT_COPY } from "@/components/item-editor";
import { LevelCard } from "@/components/level-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/screen";
import { Textarea } from "@/components/ui/textarea";
import { askCoach } from "@/lib/coach";
import { gameSummary, XP } from "@/lib/game";
import { journeyFor, PHASE_COPY, type Journey } from "@/lib/journey";
import { ALL_FACTS, nextStep } from "@/lib/knowledge";
import { useNav } from "@/lib/nav";
import {
  BADGE_COPY,
  EFFECT_COPY,
  bodyAverages,
  dayAdherence,
  daysOfStock,
  effectHistory,
} from "@/lib/stats";
import { appToday, useSupplime } from "@/lib/store";
import type { BadgeId, DecisionKind, Verdict } from "@/lib/types";
import { addDays, cn, daysBetween, formatShortDate } from "@/lib/utils";

export function JourneyView() {
  const state = useSupplime();
  const { stack, logs, effects, decisions, profile } = state;
  const open = useNav((s) => s.open);
  const today = appToday();
  const game = useMemo(() => gameSummary(state, today), [state, today]);
  const active = stack.filter((i) => !i.archived && !i.paused);
  const past = stack.filter((i) => i.archived);
  const journeys = active
    .map((item) => journeyFor({ item, logs, effects, decisions, today }))
    .sort((a, b) => Number(b.evaluateDue) - Number(a.evaluateDue));

  const chart = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(today, i - 13);
    const a = dayAdherence(stack, logs, date);
    return { date: formatShortDate(date), taken: a.taken, scheduled: a.scheduled };
  });

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Your experiments</p>
        <h1 className="font-display text-3xl tracking-tight">Journey</h1>
        {profile.why && <p className="mt-1 text-sm text-primary italic">“{profile.why}”</p>}
      </header>

      <LevelCard game={game} />
      <StreakDots days={game.lastDays} />

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl tracking-tight">How long until it works</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Each supplement is an experiment. The bar runs to its verdict day; the markers show when
            people usually feel it and when a dose change is allowed.
          </p>
        </div>
        {journeys.length === 0 && (
          <p className="text-sm text-muted-foreground">Nothing active right now.</p>
        )}
        {journeys.map((j) => (
          <JourneyCard
            key={j.item.id}
            j={j}
            onEvaluate={() => open({ kind: "evaluate", itemId: j.item.id })}
            onOpen={() => open({ kind: "editor", itemId: j.item.id })}
          />
        ))}
      </section>

      <FieldNotes />

      <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
        <p className="text-sm font-medium">Last 14 days</p>
        <div className="mt-3 h-36">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} barCategoryGap={6}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10 }}
                interval={2}
                axisLine={false}
                tickLine={false}
              />
              <YAxis hide />
              <Tooltip
                cursor={{ fill: "rgba(61,90,76,0.08)" }}
                contentStyle={{
                  background: "#fbfaf6",
                  border: "1px solid #ddd6c8",
                  borderRadius: 12,
                  fontSize: 12,
                }}
              />
              <Bar dataKey="scheduled" fill="#e7e2d6" radius={[4, 4, 0, 0]} name="planned" />
              <Bar dataKey="taken" fill="#3d5a4c" radius={[4, 4, 0, 0]} name="taken" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {past.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-xl tracking-tight">Past experiments</h2>
          {past.map((item) => {
            const days = daysBetween(item.startedAt, item.archived!.date) + 1;
            return (
              <button
                type="button"
                key={item.id}
                onClick={() => open({ kind: "editor", itemId: item.id })}
                className="w-full rounded-2xl bg-card px-4 py-3 text-left shadow-[var(--shadow-border)]"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium">{item.name}</p>
                  <Badge variant={item.archived!.verdict === "worked" ? "ok" : "default"}>
                    {VERDICT_COPY[item.archived!.verdict]}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {days} days, up to {Math.max(...item.doseHistory.map((s) => s.amount))}{" "}
                  {item.unit}
                  {item.archived!.note ? ` · “${item.archived!.note}”` : ""}
                </p>
              </button>
            );
          })}
        </section>
      )}

      <section>
        <h2 className="font-display text-xl tracking-tight">Marks</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(BADGE_COPY) as BadgeId[]).map((id) => {
            const earned = profile.badges.includes(id);
            return (
              <Badge key={id} variant={earned ? "solid" : "default"} title={BADGE_COPY[id].detail}>
                {!earned && <Lock className="mr-1 size-3" />}
                {BADGE_COPY[id].name}
              </Badge>
            );
          })}
        </div>
      </section>

      <Coach />

      <p className="pb-4 text-xs text-muted-foreground">
        Supplime is a personal tracker, not medical advice. Timelines are typical ranges from common
        use and studies, not a promise of what you will feel. Check with a clinician before changing
        doses if you take medication.
      </p>
    </div>
  );
}

function StreakDots({ days }: { days: { date: string; outcome: string }[] }) {
  if (days.length === 0) return null;
  return (
    <div className="flex items-center justify-between gap-1 px-1" aria-label="Last 14 days">
      {days.map((d) => (
        <span
          key={d.date}
          title={`${formatShortDate(d.date)}: ${d.outcome}`}
          className={cn(
            "h-2.5 flex-1 rounded-full",
            d.outcome === "success" && "bg-primary",
            d.outcome === "shielded" && "bg-primary/40",
            d.outcome === "broken" && "bg-warn/50",
            (d.outcome === "open" || d.outcome === "empty") && "bg-muted",
          )}
        />
      ))}
    </div>
  );
}

const TONE = {
  muted: "bg-secondary text-muted-foreground",
  accent: "bg-accent text-accent-foreground",
  warn: "bg-warn/15 text-warn",
  good: "bg-primary text-primary-foreground",
} as const;

export function JourneyCard({
  j,
  onEvaluate,
  onOpen,
}: {
  j: Journey;
  onEvaluate: () => void;
  onOpen: () => void;
}) {
  const phase = PHASE_COPY[j.phase];
  const span = Math.max(...j.milestones.map((m) => m.day), j.day, j.felt?.day ?? 0) * 1.05;
  const pct = (d: number) => `${Math.min(100, (d / span) * 100)}%`;
  const p = j.profile;
  return (
    <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
      <button type="button" onClick={onOpen} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium">{j.item.name}</p>
            <p className="text-xs text-muted-foreground">
              Day {j.day} · {j.takenDays} taken
              {j.consistency !== null ? ` (${Math.round(j.consistency * 100)}%)` : ""} · {j.atDose}d
              at {j.item.amount} {j.item.unit}
            </p>
          </div>
          <span
            className={cn(
              "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium",
              TONE[phase.tone],
            )}
          >
            {phase.label}
          </span>
        </div>

        {/* Timeline */}
        <div className="relative mt-5 mb-7 h-3 rounded-full bg-muted">
          <div
            className="absolute inset-y-0 rounded-full bg-accent"
            style={{
              left: pct(p.firstSignsDay),
              width: `calc(${pct(p.windowEndDay)} - ${pct(p.firstSignsDay)})`,
            }}
          />
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary/75"
            style={{ width: pct(j.day) }}
          />
          {j.milestones
            .filter((m) => m.key !== "start")
            .map((m) => (
              <span
                key={m.key}
                className={cn(
                  "absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card",
                  m.reached ? "bg-primary" : "bg-muted-foreground/50",
                )}
                style={{ left: pct(m.day) }}
                title={`${m.label} · day ${m.day}`}
              />
            ))}
          {j.felt && (
            <span
              className="absolute -top-1.5 size-6 -translate-x-1/2 rounded-full border-2 border-card bg-primary text-center text-[10px] leading-5 text-primary-foreground"
              style={{ left: pct(j.felt.day) }}
              title={`Felt it on day ${j.felt.day}`}
            >
              ✓
            </span>
          )}
          <span className="absolute top-4 left-0 text-[10px] text-muted-foreground">day 1</span>
          <span className="absolute top-4 right-0 text-[10px] text-muted-foreground">
            verdict d{j.milestones.find((m) => m.key === "evaluate")?.day}
          </span>
        </div>

        <p className="text-sm">
          {j.felt ? (
            <>
              You first felt it on <span className="font-medium">day {j.felt.day}</span> (most
              people: ~day {p.typicalDay}).
            </>
          ) : p.kind === "acute" && p.minutes ? (
            <>
              Works within {p.minutes.min}–{p.minutes.max} min; judge it over {p.windowEndDay} days.
            </>
          ) : (
            <>
              Most people notice it around <span className="font-medium">day {p.typicalDay}</span>{" "}
              (range {p.firstSignsDay}–{p.windowEndDay}).
            </>
          )}
        </p>
        {j.next && (
          <p className="mt-1 text-xs text-muted-foreground">
            Next: {j.next.label}{" "}
            {j.next.day > j.day
              ? `in ${j.next.day - j.day} day${j.next.day - j.day === 1 ? "" : "s"}`
              : "now"}{" "}
            · {formatShortDate(j.next.date)}
          </p>
        )}
        {!j.doseReviewOpen && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3" /> Dose change unlocks {formatShortDate(j.doseReviewDate)} (
            {p.minDaysBeforeIncrease} days at one dose)
          </p>
        )}
        {daysOfStock(j.item) <= j.item.reorderAtDays && (
          <p className="mt-1 text-xs text-warn">
            Only {daysOfStock(j.item)} days left in the bottle.
          </p>
        )}
      </button>

      <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
        <p className="min-w-0 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{j.recommendation.title}.</span>{" "}
          {j.recommendation.why}
        </p>
        <Button
          size="sm"
          variant={j.evaluateDue ? "default" : "outline"}
          className="shrink-0"
          onClick={onEvaluate}
        >
          {j.evaluateDue ? "Verdict" : "Review"}
        </Button>
      </div>
    </div>
  );
}

/** Keep / step up / lower / more time / stop, with Supplime's recommendation first. */
export function EvaluateSheet({ itemId }: { itemId: string }) {
  const close = useNav((s) => s.close);
  const { stack, logs, effects, decisions, decide } = useSupplime();
  const item = stack.find((i) => i.id === itemId);
  const [note, setNote] = useState("");
  const [verdict, setVerdict] = useState<Verdict>("no-effect");
  const [choice, setChoice] = useState<DecisionKind | null>(null);
  if (!item) return null;
  const today = appToday();
  const j = journeyFor({ item, logs, effects, decisions, today });
  const up = nextStep(item, 1);
  const down = nextStep(item, -1);
  const checks = effectHistory(item, effects).slice(-5);
  const pick = choice ?? j.recommendation.kind;
  const lastNote = [...j.decisions].reverse().find((d) => d.note);

  const options: { kind: DecisionKind; label: string; detail: string; disabled?: boolean }[] = [
    { kind: "keep", label: `Keep ${item.amount} ${item.unit}`, detail: "It's doing its job." },
    {
      kind: "step-up",
      label: up ? `Step up to ${up} ${item.unit}` : "Step up",
      detail: !j.doseReviewOpen
        ? `Locked until ${formatShortDate(j.doseReviewDate)}`
        : up
          ? "New step; the clock restarts."
          : "Already at the usual top dose.",
      disabled: !up || !j.doseReviewOpen,
    },
    {
      kind: "lower",
      label: down ? `Lower to ${down} ${item.unit}` : "Lower",
      detail: down
        ? "Less can be more, especially with side effects."
        : "Already at the lowest usual dose.",
      disabled: !down,
    },
    { kind: "more-time", label: "Give it 2 more weeks", detail: "Not enough to judge yet." },
    { kind: "stop", label: "Stop", detail: "Keep the record as a finished experiment." },
  ];

  return (
    <Sheet
      onClose={close}
      title={`${item.name}: verdict`}
      description={`Day ${j.day} · ${j.atDose} days at ${item.amount} ${item.unit}`}
    >
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat value={`${j.day}`} label="days on it" />
          <Stat
            value={j.consistency === null ? "—" : `${Math.round(j.consistency * 100)}%`}
            label="consistency"
          />
          <Stat value={j.felt ? `d${j.felt.day}` : "—"} label="first felt" />
        </div>
        {checks.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Check-ins:{" "}
            {checks
              .map(
                (e) =>
                  `${formatShortDate(e.date)} ${EFFECT_COPY[e.rating]}${e.sideEffects ? " (side effects)" : ""}`,
              )
              .join(" · ")}
          </p>
        )}
        {lastNote && (
          <p className="rounded-xl bg-secondary px-3 py-2 text-xs">
            Your note from {formatShortDate(lastNote.date)}: “{lastNote.note}”
          </p>
        )}
        <div className="rounded-2xl bg-accent/70 p-3">
          <p className="text-xs font-medium tracking-wide text-accent-foreground uppercase">
            Supplime suggests
          </p>
          <p className="mt-0.5 font-medium">{j.recommendation.title}</p>
          <p className="text-sm text-muted-foreground">{j.recommendation.why}</p>
        </div>
        <div className="grid gap-2">
          {options.map((o) => (
            <button
              key={o.kind}
              type="button"
              disabled={o.disabled}
              onClick={() => setChoice(o.kind)}
              className={cn(
                "rounded-xl px-4 py-2.5 text-left disabled:opacity-45",
                pick === o.kind ? "bg-primary text-primary-foreground" : "bg-secondary",
              )}
            >
              <span className="block text-sm font-medium">{o.label}</span>
              <span
                className={cn(
                  "block text-xs",
                  pick === o.kind ? "text-primary-foreground/80" : "text-muted-foreground",
                )}
              >
                {o.detail}
              </span>
            </button>
          ))}
        </div>
        {pick === "stop" && (
          <div className="flex flex-wrap gap-2">
            {(Object.keys(VERDICT_COPY) as Verdict[]).map((v) => (
              <Chip key={v} on={verdict === v} onClick={() => setVerdict(v)}>
                {VERDICT_COPY[v]}
              </Chip>
            ))}
          </div>
        )}
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note to future you: what you noticed, why you decided this"
        />
        <Button
          className="w-full"
          onClick={() => {
            decide(item.id, pick, {
              to:
                pick === "step-up"
                  ? (up ?? undefined)
                  : pick === "lower"
                    ? (down ?? undefined)
                    : undefined,
              note,
              verdict,
            });
            toast(`Decision logged: +${XP.decision} XP`, {
              description:
                pick === "step-up"
                  ? `${up} ${item.unit} from today.`
                  : pick === "lower"
                    ? `${down} ${item.unit} from today.`
                    : pick === "stop"
                      ? "Moved to past experiments."
                      : pick === "keep"
                        ? "Next check in about 2 months."
                        : "Supplime will ask again in 2 weeks.",
            });
            close();
          }}
        >
          Save decision
        </Button>
      </div>
    </Sheet>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-secondary px-2 py-3">
      <p className="font-display text-xl tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function FieldNotes() {
  const facts = useSupplime((s) => s.profile.facts);
  const [open, setOpen] = useState(false);
  const collected = facts
    .map((f) => {
      const [date, id] = f.split("|");
      return { date: date!, fact: ALL_FACTS.find((x) => x.id === id) };
    })
    .filter((x) => x.fact)
    .reverse();
  return (
    <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
      <button
        type="button"
        className="flex w-full items-center gap-3 text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <Sparkles className="size-5 text-primary" />
        <span className="flex-1">
          <span className="block font-medium">Field notes</span>
          <span className="block text-xs text-muted-foreground">
            {collected.length} of {ALL_FACTS.length} collected · one unlocks each complete day
          </span>
        </span>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
      </button>
      {open && (
        <ul className="mt-3 space-y-2">
          {collected.length === 0 && (
            <li className="text-sm text-muted-foreground">
              Complete a day to unlock your first note.
            </li>
          )}
          {collected.map(({ date, fact }) => (
            <li key={fact!.id} className="rounded-xl bg-secondary px-3 py-2 text-sm">
              {fact!.text}
              <span className="mt-1 block text-[11px] text-muted-foreground">
                {formatShortDate(date)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Coach() {
  const state = useSupplime();
  const { stack, logs, effects, decisions, profile, body, setCoach } = state;
  const [busy, setBusy] = useState(false);
  const today = appToday();

  async function run() {
    setBusy(true);
    try {
      const avgs = bodyAverages(body, 7, today);
      const week = gameSummary(state, today).week;
      const result = await askCoach(
        {
          name: profile.displayName,
          goals: profile.goals,
          stack: stack
            .filter((i) => !i.archived && !i.paused)
            .map((item) => {
              const j = journeyFor({ item, logs, effects, decisions, today });
              return {
                name: item.name,
                amount: item.amount,
                unit: item.unit,
                foodTiming: item.foodTiming,
                slots: item.slots,
                daysOn: j.day,
                daysAtCurrentDose: j.atDose,
                daysActuallyTaken: j.takenDays,
                doseHistory: item.doseHistory,
                effectCheckIns: effectHistory(item, effects).map((e) => ({
                  date: e.date,
                  rating: EFFECT_COPY[e.rating],
                  note: e.note,
                })),
                daysLeft: daysOfStock(item),
              };
            }),
          adherence7: week.rate,
          streak: gameSummary(state, today).streak,
          body: {
            sleepHours: avgs.sleepHours,
            sleepScore: avgs.sleepScore,
            restingHr: avgs.restingHr,
            hrv: avgs.hrv,
            energy: avgs.energy,
            mood: avgs.mood,
            focus: avgs.focus,
          },
        },
        profile.coachKey ?? "",
        profile.coachModel || undefined,
      );
      if (!result.ok) toast.error(result.error);
      else setCoach(result.result);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl tracking-tight">Coach</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            A second opinion on your timing, doses and gaps. Not a prescription.
          </p>
        </div>
        <Button size="sm" onClick={run} disabled={busy || stack.length === 0 || !profile.coachKey}>
          {busy ? "Reading…" : "Ask"}
        </Button>
      </div>
      {!profile.coachKey && (
        <p className="mt-3 text-xs text-muted-foreground">
          Optional. Add your own xAI (Grok) API key in Settings to turn this on.
        </p>
      )}
      {profile.lastCoach && (
        <div className="mt-4 space-y-3 text-sm">
          <p>{profile.lastCoach.summary}</p>
          {[...profile.lastCoach.timing, ...profile.lastCoach.dosage].map((t) => (
            <p key={t} className="text-muted-foreground">
              {t}
            </p>
          ))}
          {profile.lastCoach.ideas.map((idea) => (
            <div key={idea.name}>
              <p className="font-medium">{idea.name}</p>
              <p className="text-muted-foreground">
                {idea.why} {idea.caution}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
