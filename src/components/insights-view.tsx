import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { askCoach } from "@/lib/coach";
import { CATALOG_BY_ID } from "@/lib/catalog";
import { useNav } from "@/lib/nav";
import {
  BADGE_COPY,
  EFFECT_COPY,
  bodyAverages,
  dayAdherence,
  daysOn,
  daysOfStock,
  effectHistory,
  effectWindow,
  firstFelt,
  latestEffect,
  loggingConsistency,
  rangeAdherence,
  ritualScore,
  suggestions,
  takenDays,
} from "@/lib/stats";
import { useSupplime } from "@/lib/store";
import type { BadgeId } from "@/lib/types";
import { addDays, formatShortDate, todayKey } from "@/lib/utils";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function InsightsView() {
  const stack = useSupplime((s) => s.stack);
  const logs = useSupplime((s) => s.logs);
  const body = useSupplime((s) => s.body);
  const effects = useSupplime((s) => s.effects);
  const profile = useSupplime((s) => s.profile);
  const setCoach = useSupplime((s) => s.setCoach);
  const go = useNav((s) => s.go);
  const [busy, setBusy] = useState(false);
  const today = todayKey();
  const score = ritualScore(stack, logs, body, today);
  const weekFrom = addDays(today, -13);
  const week = rangeAdherence(stack, logs, addDays(today, -6), today);
  const avgs = bodyAverages(body, 7, today);
  const ideas = suggestions(stack, profile.goals);

  const chart = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(weekFrom, i);
    const day = dayAdherence(stack, logs, date);
    return {
      date: formatShortDate(date),
      taken: day.taken,
      scheduled: day.scheduled,
    };
  });

  async function runCoach() {
    setBusy(true);
    try {
      const result = await askCoach(
        {
          name: profile.displayName,
          goals: profile.goals,
          stack: stack
            .filter((item) => !item.paused)
            .map((item) => ({
              name: item.name,
              amount: item.amount,
              unit: item.unit,
              foodTiming: item.foodTiming,
              slots: item.slots,
              daysOn: daysOn(item),
              daysAtCurrentDose: effectWindow(item).atDose,
              daysActuallyTaken: takenDays(item, logs),
              doseHistory: item.doseHistory,
              effectCheckIns: effectHistory(item, effects).map((e) => ({
                date: e.date,
                rating: EFFECT_COPY[e.rating],
                note: e.note,
              })),
              daysLeft: daysOfStock(item),
            })),
          adherence7: week.rate,
          streak: score.streak,
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
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setCoach(result.result);
    } catch {
      toast.error("Coach is unavailable right now.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header>
        <p className="text-sm text-muted-foreground">How you're doing</p>
        <h1 className="font-display text-3xl tracking-tight">Record</h1>
      </header>

      <section className="grid grid-cols-3 gap-2">
        <Stat label="Streak" value={`${score.streak}d`} />
        <Stat label="Week" value={`${Math.round(week.rate * 100)}%`} />
        <Stat label="Score" value={`${score.score}`} />
      </section>

      <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
        <p className="text-sm font-medium">Last 14 days</p>
        <div className="mt-3 h-40">
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
              <Bar dataKey="taken" fill="#3d5a4c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-display text-xl tracking-tight">Onset windows</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Shaded: when people usually notice it. Dot: the day you first felt it.
          </p>
        </div>
        {stack.length === 0 && (
          <p className="text-sm text-muted-foreground">Add a stack to track onset.</p>
        )}
        {stack.map((item) => {
          const w = effectWindow(item);
          const cat = item.catalogId ? CATALOG_BY_ID[item.catalogId] : undefined;
          const felt = firstFelt(item, effects);
          const last = latestEffect(item, effects);
          const taken = takenDays(item, logs);
          const working = !!felt && !!last && last.rating >= 2;
          const consistency = loggingConsistency(item, logs);
          return (
            <button
              type="button"
              key={item.id}
              onClick={() => go("stack", item.id)}
              className="w-full rounded-xl bg-card p-4 text-left shadow-[var(--shadow-border)]"
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="font-medium">{item.name}</p>
                <p className="text-xs tabular-nums text-muted-foreground">
                  day {w.elapsed} · {taken} taken
                </p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{w.label}</p>
              <OnsetBar
                elapsed={w.elapsed}
                min={w.onsetMin}
                max={w.onsetMax}
                feltDay={felt?.day ?? null}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {felt
                  ? `You first felt it on day ${felt.day}${cat ? ` (typical: days ${cat.onset.days.min}–${cat.onset.days.max})` : ""}.`
                  : w.detail}
              </p>
              {working ? (
                <p className="mt-2 text-sm">
                  Working at {item.amount} {item.unit}. Hold the dose.
                </p>
              ) : w.readyToIncrease ? (
                <p className="mt-2 text-sm">
                  Dose check: {w.increaseGuidance}
                  {cat ? ` Ceiling: ${cat.typicalCeiling}.` : ""}
                </p>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">
                  Dose review on {formatShortDate(w.reviewOn)} ({w.atDose} day
                  {w.atDose === 1 ? "" : "s"} at {item.amount} {item.unit} so far).
                </p>
              )}
              {consistency && consistency.span >= 7 && consistency.rate < 0.8 && (
                <p className="mt-2 text-xs text-warn">
                  Taken {consistency.taken} of the last {consistency.span} days. Missed days push
                  the onset window back.
                </p>
              )}
            </button>
          );
        })}
      </section>

      <section>
        <h2 className="font-display text-xl tracking-tight">Marks</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {(Object.keys(BADGE_COPY) as BadgeId[]).map((id) => {
            const earned = profile.badges.includes(id);
            const copy = BADGE_COPY[id];
            return (
              <Badge key={id} variant={earned ? "solid" : "default"}>
                {copy.name}
              </Badge>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Quiet marks for showing up — not a game, just a record.
        </p>
      </section>

      {ideas.length > 0 && (
        <section>
          <h2 className="font-display text-xl tracking-tight">Worth considering</h2>
          <div className="mt-3 space-y-2">
            {ideas.map((idea) => (
              <div
                key={idea.name}
                className="rounded-xl bg-card px-4 py-3 shadow-[var(--shadow-border)]"
              >
                <p className="font-medium">{idea.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{idea.why}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-xl tracking-tight">Coach</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Ask for a read on timing, dose increases, and gaps — not a prescription.
            </p>
          </div>
          <Button
            size="sm"
            onClick={runCoach}
            disabled={busy || stack.length === 0 || !profile.coachKey}
          >
            {busy ? "Reading…" : "Ask"}
          </Button>
        </div>
        {!profile.coachKey && (
          <p className="mt-3 text-xs text-muted-foreground">
            Optional. Paste your own xAI (Grok) API key in Settings to turn this on. It sends your
            stack, check-ins and averages to xAI only when you tap Ask.
          </p>
        )}
        {profile.lastCoach && (
          <div className="mt-4 space-y-3 text-sm">
            <p>{profile.lastCoach.summary}</p>
            {profile.lastCoach.timing.map((t) => (
              <p key={t} className="text-muted-foreground">
                {t}
              </p>
            ))}
            {profile.lastCoach.dosage.map((t) => (
              <p key={t}>{t}</p>
            ))}
            {profile.lastCoach.ideas.map((idea) => (
              <div key={idea.name}>
                <p className="font-medium">{idea.name}</p>
                <p className="text-muted-foreground">
                  {idea.why} {idea.caution}
                </p>
              </div>
            ))}
            {profile.lastCoach.bodyNotes.map((t) => (
              <p key={t} className="text-muted-foreground">
                {t}
              </p>
            ))}
          </div>
        )}
      </section>

      <p className="pb-4 text-xs text-muted-foreground">
        Supplime is a personal tracker, not medical advice. Windows are typical ranges from common
        use, not a guarantee you will feel anything on a given day.
      </p>
    </div>
  );
}

/** Your day on a strip with the typical onset window shaded and the day you felt it marked. */
function OnsetBar({
  elapsed,
  min,
  max,
  feltDay,
}: {
  elapsed: number;
  min: number;
  max: number;
  feltDay: number | null;
}) {
  const span = Math.max(max * 1.25, elapsed, feltDay ?? 0, 7);
  const pct = (n: number) => `${Math.min(100, (n / span) * 100)}%`;
  return (
    <div className="relative mt-3 h-3 w-full rounded-full bg-muted" aria-hidden>
      <div
        className="absolute inset-y-0 rounded-full bg-accent"
        style={{ left: pct(min), width: `calc(${pct(max)} - ${pct(min)})` }}
      />
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-primary/70"
        style={{ width: pct(elapsed) }}
      />
      {feltDay != null && (
        <div
          className="absolute -top-1 size-5 -translate-x-1/2 rounded-full border-2 border-card bg-primary"
          style={{ left: pct(feltDay) }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card px-3 py-4 text-center shadow-[var(--shadow-border)]">
      <p className="font-display text-2xl tabular-nums tracking-tight">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
