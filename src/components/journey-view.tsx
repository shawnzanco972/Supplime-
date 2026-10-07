import { Lock, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/fields";
import { VERDICT_COPY } from "@/components/item-editor";
import { LevelCard } from "@/components/level-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/screen";
import { Textarea } from "@/components/ui/textarea";
import { advise, beforeAfter, fmtDose } from "@/lib/advisor";
import { dayGrid, METRIC_COPY, skipImpact, type Cell } from "@/lib/insights";
import { askGemini, askGrok, buildCoachPrompt, shareToAssistant } from "@/lib/coach";
import { iconFor } from "@/components/product-picker";
import { countedDecisions, gameSummary, XP } from "@/lib/game";
import { doseLabel, journeyFor, PHASE_COPY, type Journey } from "@/lib/journey";
import { ALL_FACTS, nextStep, unitStrength } from "@/lib/knowledge";
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
  const active = stack.filter((i) => !i.archived && !i.paused && !i.planned);
  const past = stack.filter((i) => i.archived);
  const journeys = active
    .map((item) => journeyFor({ item, logs, effects, decisions, today }))
    .sort((a, b) => Number(b.evaluateDue) - Number(a.evaluateDue));

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">Your experiments</p>
        <h1 className="font-display text-3xl tracking-tight">Journey</h1>
        {profile.why && <p className="mt-1 text-sm text-primary italic">“{profile.why}”</p>}
      </header>

      <LevelCard game={game} />
      <StreakDots days={game.lastDays} />

      <WhatsNext />

      <DayGridCard />

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

      <Findings />

      <FieldNotes />

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

const CELL: Record<Cell, string> = {
  taken: "bg-primary",
  partial: "bg-primary/45",
  missed: "bg-warn/55",
  open: "border border-dashed border-muted-foreground/40",
  none: "bg-transparent",
};

/** Every supplement over the last 14 days, with your sleep underneath. */
function DayGridCard() {
  const { stack, logs, body } = useSupplime();
  const today = appToday();
  const g = useMemo(() => dayGrid({ stack, logs, body, today }), [stack, logs, body, today]);
  if (g.rows.length === 0) return null;
  const hasSleep = g.sleep.some((h) => h !== undefined);
  const max = Math.max(9, ...g.sleep.map((h) => h ?? 0));
  const cols = { gridTemplateColumns: `5.5rem repeat(${g.dates.length}, minmax(0, 1fr))` };
  return (
    <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
      <div className="flex items-baseline justify-between gap-2">
        <p className="font-medium">Last 14 days</p>
        <p className="text-[11px] text-muted-foreground">
          {formatShortDate(g.dates[0]!)} – today
        </p>
      </div>
      <div className="mt-3 space-y-1.5" role="table" aria-label="Doses per day">
        {g.rows.map((r) => (
          <div key={r.item.id} className="grid items-center gap-[3px]" style={cols} role="row">
            <span className="truncate pr-1 text-xs" role="rowheader">
              {r.item.name}
            </span>
            {r.cells.map((c, i) => (
              <span
                key={g.dates[i]}
                role="cell"
                title={`${formatShortDate(g.dates[i]!)}: ${c}`}
                className={cn("h-4 rounded-[4px]", CELL[c])}
              />
            ))}
          </div>
        ))}
        {hasSleep && (
          <div className="grid items-end gap-[3px] pt-1" style={cols} role="row">
            <span className="text-xs text-muted-foreground" role="rowheader">
              Sleep after
            </span>
            {g.sleep.map((h, i) => (
              <span key={g.dates[i]} className="flex h-10 flex-col justify-end" role="cell">
                {h !== undefined && (
                  <span
                    title={`${h} h the night after ${formatShortDate(g.dates[i]!)}`}
                    className={cn("rounded-[3px]", g.poorSleep[i] ? "bg-warn/70" : "bg-accent")}
                    style={{ height: `${Math.max(12, (h / max) * 100)}%` }}
                  />
                )}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        <Legend className="bg-primary" label="taken" />
        <Legend className="bg-primary/45" label="part" />
        <Legend className="bg-warn/55" label="missed" />
        {hasSleep && <Legend className="bg-warn/70" label="rough night" />}
      </div>
      {g.note ? (
        <p className="mt-2 text-sm">{g.note}</p>
      ) : (
        !hasSleep && (
          <p className="mt-2 text-xs text-muted-foreground">
            Connect Fitbit / Google Health on the Body tab to see your sleep under each day and
            spot nights that follow a missed dose.
          </p>
        )
      )}
    </section>
  );
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={cn("size-2.5 rounded-[3px]", className)} /> {label}
    </span>
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
  const body = useSupplime((s) => s.body);
  const logs = useSupplime((s) => s.logs);
  const deltas = beforeAfter(j.item, body, appToday());
  const impact = skipImpact(j.item, logs, body, appToday());
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
              at {doseLabel(j.item, j.item.amount)}
              {j.item.slots.length > 1 ? ` ×${j.item.slots.length}/day` : ""}
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
        {j.missedDays > 0 && p.kind !== "acute" && !j.felt && (
          <p className="mt-1 text-xs text-muted-foreground">
            {j.missedDays} missed day{j.missedDays === 1 ? "" : "s"} at this dose: expect it about{" "}
            {j.missedDays} day{j.missedDays === 1 ? "" : "s"} later than usual. It builds up with
            the days you actually take it.
          </p>
        )}
        {impact.length > 0 && (
          <div className="mt-2 space-y-1">
            {impact.map((x) => (
              <p
                key={x.metric}
                className={cn(
                  "rounded-lg px-2 py-1 text-xs",
                  x.helps ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground",
                )}
              >
                {METRIC_COPY[x.metric].label} after days you took it: {x.taken}
                {METRIC_COPY[x.metric].unit} vs {x.missed}
                {METRIC_COPY[x.metric].unit} after the {x.missedNights} days you missed it.
              </p>
            ))}
          </div>
        )}
        {!j.doseReviewOpen && !j.changedToday && (
          <p className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="size-3" /> Dose change unlocks {formatShortDate(j.doseReviewDate)} (
            {p.minDaysBeforeIncrease} days at one dose)
          </p>
        )}
        {deltas.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {deltas.map((d) => (
              <span
                key={d.metric}
                className={cn(
                  "rounded-lg px-2 py-1 text-xs",
                  d.better
                    ? "bg-accent text-accent-foreground"
                    : "bg-secondary text-muted-foreground",
                )}
              >
                {d.metric === "sleepHours"
                  ? "Sleep"
                  : d.metric === "restingHr"
                    ? "Resting HR"
                    : "HRV"}{" "}
                {d.before} → {d.after}
                {d.metric === "sleepHours" ? " h" : d.metric === "hrv" ? " ms" : ""}
              </span>
            ))}
          </div>
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

  const perDay = Math.max(1, item.slots.length);
  const locked = !j.doseReviewOpen && !j.changedToday;
  const guessed = !unitStrength(item).known;
  const perDayNote = (amount: number) =>
    perDay > 1 ? ` · ${perDay}× a day = ${round(amount * perDay)} ${item.unit}/day` : "";
  const options: { kind: DecisionKind; label: string; detail: string; disabled?: boolean }[] = [
    {
      kind: "keep",
      label: `Keep ${doseLabel(item, item.amount)}`,
      detail: `It's doing its job${perDayNote(item.amount)}.`,
    },
    {
      kind: "step-up",
      label: up ? `Step up to ${doseLabel(item, up)}` : "Step up",
      detail: locked
        ? `Locked until ${formatShortDate(j.doseReviewDate)}`
        : up
          ? `One more pill per dose${perDayNote(up)}. The clock restarts.`
          : "Already at the usual top dose.",
      disabled: !up || locked,
    },
    {
      kind: "lower",
      label: down ? `Lower to ${doseLabel(item, down)}` : "Lower",
      detail: down
        ? `Less can be more, especially with side effects${perDayNote(down)}.`
        : "Already at the lowest usual dose.",
      disabled: !down,
    },
    { kind: "more-time", label: "Give it 2 more weeks", detail: "Not enough to judge yet." },
    { kind: "stop", label: "Stop", detail: "Keep the record as a finished experiment." },
  ];
  const earnsXp =
    countedDecisions([...decisions, { id: "new", itemId: item.id, date: today, kind: pick }]) >
    countedDecisions(decisions.filter((d) => !(d.itemId === item.id && d.date === today)));

  return (
    <Sheet
      onClose={close}
      title={`${item.name}: verdict`}
      description={`Day ${j.day} · ${j.atDose} day${j.atDose === 1 ? "" : "s"} at ${doseLabel(item, item.amount)}${perDayNote(item.amount)}`}
    >
      <div className="space-y-4">
        {j.changedToday && j.previousStep && (
          <p className="rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
            You changed this today (was {j.previousStep.amount} {j.previousStep.unit}). Revising it
            today is free: it stays one change, with no waiting period and no extra XP.
          </p>
        )}
        {j.holding && j.lastDecision && !j.changedToday && (
          <p className="rounded-xl bg-accent px-3 py-2 text-sm text-accent-foreground">
            You already decided on {formatShortDate(j.lastDecision.date)}. Next check{" "}
            {formatShortDate(j.nextEval)}. You can change your mind, but it won't earn XP again.
          </p>
        )}
        {guessed && (up || down) && (
          <p className="text-xs text-muted-foreground">
            Steps assume {round(unitStrength(item).amount)} {item.unit} per pill. Pick your exact
            bottle in the editor to be sure.
          </p>
        )}
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
            toast(earnsXp ? `Decision logged: +${XP.decision} XP` : "Decision updated", {
              description:
                pick === "step-up"
                  ? `${doseLabel(item, up!)} from today.`
                  : pick === "lower"
                    ? `${doseLabel(item, down!)} from today.`
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

const round = (n: number) => Math.round(n * 100) / 100;

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
  const { profile, addCoachNote, setProfile } = state;
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const today = appToday();
  const provider = profile.coachProvider ?? "share";

  async function run() {
    const prompt = buildCoachPrompt(state, today);
    if (provider === "share") {
      try {
        const how = await shareToAssistant(prompt);
        setShowPaste(true);
        toast(
          how === "shared" ? "Pick Claude or Gemini" : "Copied — paste it into Claude or Gemini",
          {
            description: "Then paste the answer back here to keep it.",
          },
        );
      } catch {
        /* share sheet dismissed */
      }
      return;
    }
    setBusy(true);
    try {
      const text =
        provider === "gemini"
          ? await askGemini(prompt, profile.geminiKey ?? "", profile.coachModel || undefined)
          : await askGrok(prompt, profile.coachKey ?? "", profile.coachModel || undefined);
      addCoachNote(text, provider === "gemini" ? "Gemini" : "Grok");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Coach is unavailable right now.");
    } finally {
      setBusy(false);
    }
  }

  const notes = [...(profile.coachNotes ?? [])].reverse();
  const needsKey =
    (provider === "gemini" && !profile.geminiKey) || (provider === "xai" && !profile.coachKey);
  return (
    <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
      <h2 className="font-display text-xl tracking-tight">Coach</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Supplime writes a full briefing — your stack, doses, consistency, check-ins, side effects
        and wearable data — and asks for timing, dose, next-step and safety advice.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1">
        {(
          [
            ["share", "Claude / Gemini app"],
            ["gemini", "Gemini key"],
            ["xai", "Grok key"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setProfile({ coachProvider: k })}
            className={cn(
              "min-h-10 rounded-lg px-1 text-xs font-medium",
              provider === k ? "bg-card shadow-sm" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {provider === "share"
          ? "Free with your Claude or Gemini subscription: the briefing opens in the app you pick."
          : provider === "gemini"
            ? "Gemini's free API tier — get a key at aistudio.google.com and add it in Settings."
            : "Your own xAI key, added in Settings."}
      </p>
      <Button
        className="mt-3 w-full"
        onClick={run}
        disabled={busy || needsKey || state.stack.length === 0}
      >
        {busy ? "Asking…" : provider === "share" ? "Send my briefing" : "Ask now"}
      </Button>
      {needsKey && <p className="mt-2 text-xs text-warn">Add the key in Settings first.</p>}
      {(showPaste || provider === "share") && (
        <div className="mt-3 space-y-2">
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder="Paste the answer here to keep it in your journey"
          />
          <Button
            variant="outline"
            className="w-full"
            disabled={!reply.trim()}
            onClick={() => {
              addCoachNote(reply, "Claude / Gemini");
              setReply("");
              toast("Saved to your coach notes");
            }}
          >
            Save answer
          </Button>
        </div>
      )}
      {notes.length > 0 && (
        <div className="mt-4 space-y-3">
          {notes.slice(0, 3).map((n, i) => (
            <details key={i} open={i === 0} className="rounded-xl bg-secondary px-3 py-2">
              <summary className="cursor-pointer text-xs text-muted-foreground">
                {formatShortDate(n.date)} · {n.source}
              </summary>
              <p className="mt-2 text-sm whitespace-pre-wrap">{n.text}</p>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function WhatsNext() {
  const state = useSupplime();
  const open = useNav((s) => s.open);
  const today = appToday();
  const a = advise({ ...state, today });
  const startPlanned = state.startPlanned;
  const nothing =
    !a.planned.length && !a.increases.length && !a.reconsider.length && !a.ideas.length;
  if (nothing) return null;
  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-display text-xl tracking-tight">What's next</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {a.slotOpen
            ? "Your next experiment slot is open."
            : `Next experiment slot opens ${formatShortDate(a.slotOpensOn)}.`}{" "}
          {a.slotReason}
        </p>
      </div>

      {a.planned.map((item) => (
        <div key={item.id} className="rounded-2xl bg-primary p-4 text-primary-foreground">
          <p className="text-xs tracking-wide uppercase opacity-80">In your cabinet</p>
          <p className="mt-1 font-display text-lg">Start {item.name}</p>
          <p className="mt-1 text-sm opacity-85">
            {a.slotOpen
              ? "You already own it — it's the obvious next experiment. Start it alone so you can tell what it does."
              : `Wait until ${formatShortDate(a.slotOpensOn)} so its effect isn't mixed up with the last change.`}
          </p>
          <Button
            variant="secondary"
            className="mt-3"
            disabled={!a.slotOpen}
            onClick={() => {
              startPlanned(item.id);
              toast(`${item.name}: day 1`, { description: "One new thing at a time — nice." });
            }}
          >
            {a.slotOpen ? (
              "Start it today"
            ) : (
              <>
                <Lock className="size-4" /> Locked until {formatShortDate(a.slotOpensOn)}
              </>
            )}
          </Button>
        </div>
      ))}

      {a.increases.map((x) => (
        <button
          type="button"
          key={x.item.id}
          onClick={() => open({ kind: "evaluate", itemId: x.item.id })}
          className="w-full rounded-2xl bg-card p-4 text-left shadow-[var(--shadow-border)]"
        >
          <p className="text-xs font-medium tracking-wide text-primary uppercase">
            Ready for a higher dose
          </p>
          <p className="mt-1 font-medium">
            {x.item.name}: {fmtDose(x.item, x.item.amount)} → {fmtDose(x.item, x.to)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{x.why}</p>
        </button>
      ))}

      {a.reconsider.map((r) => (
        <button
          type="button"
          key={`${r.item.id}-${r.title}`}
          onClick={() =>
            open({
              kind: r.action === "lower" || r.action === "stop" ? "evaluate" : "editor",
              itemId: r.item.id,
            })
          }
          className="w-full rounded-2xl bg-card p-4 text-left shadow-[var(--shadow-border)]"
        >
          <p className="text-xs font-medium tracking-wide text-warn uppercase">Reconsider</p>
          <p className="mt-1 font-medium">
            {r.item.name}: {r.title}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{r.detail}</p>
        </button>
      ))}

      {a.ideas.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Worth considering for your goals</p>
          {a.ideas.slice(0, 3).map((idea) => {
            const Icon = iconFor(idea.catalogId);
            return (
              <details
                key={idea.catalogId}
                className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]"
              >
                <summary className="flex cursor-pointer list-none items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{idea.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {idea.evidence} · {idea.when}
                    </span>
                  </span>
                </summary>
                <div className="mt-3 space-y-2 text-sm">
                  {idea.reasons.map((r) => (
                    <p key={r}>{r}</p>
                  ))}
                  <p className="text-muted-foreground">{idea.timing}</p>
                  {idea.watch.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Watch for: {idea.watch.join(", ").toLowerCase()}.
                    </p>
                  )}
                  {idea.products.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      On iHerb: {idea.products.slice(0, 3).join(" · ")}
                    </p>
                  )}
                  <Button size="sm" variant="outline" onClick={() => open({ kind: "add" })}>
                    Add to my cabinet
                  </Button>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Personal evidence: what you've learned about your own body so far. */
function Findings() {
  const { stack, logs, effects, decisions, body } = useSupplime();
  const today = appToday();
  const lines: { key: string; text: string }[] = [];
  for (const item of stack) {
    if (item.planned) continue;
    const j = journeyFor({ item, logs, effects, decisions, today });
    if (j.felt)
      lines.push({
        key: `${item.id}-felt`,
        text: `${item.name} kicked in for you on day ${j.felt.day} (most people: ~day ${j.profile.typicalDay}).`,
      });
    for (const d of beforeAfter(item, body, today)) {
      if (Math.abs(d.change) < (d.metric === "sleepHours" ? 0.2 : 2)) continue;
      const label =
        d.metric === "sleepHours"
          ? "sleep"
          : d.metric === "restingHr"
            ? "resting heart rate"
            : "HRV";
      lines.push({
        key: `${item.id}-${d.metric}`,
        text: `Since ${item.name}, your ${label} went ${d.before} → ${d.after}${d.better ? " — in the right direction" : ""}.`,
      });
    }
    if (item.archived)
      lines.push({
        key: `${item.id}-verdict`,
        text: `${item.name}: ${VERDICT_COPY[item.archived.verdict].toLowerCase()} after ${daysBetween(item.startedAt, item.archived.date) + 1} days.`,
      });
  }
  return (
    <section className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
      <h2 className="font-display text-xl tracking-tight">Your findings</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        What you've learned about your own body — the real point of every experiment.
      </p>
      {lines.length ? (
        <ul className="mt-3 space-y-2 text-sm">
          {lines.map((l) => (
            <li key={l.key} className="rounded-xl bg-secondary px-3 py-2">
              {l.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm">
          Nothing confirmed yet. Your first finding arrives with your first “clearly better”
          check-in, or once a week of wearable data sits on both sides of a start date.
        </p>
      )}
    </section>
  );
}
