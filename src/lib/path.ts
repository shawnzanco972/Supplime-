import { journeyFor, STREAK_GOAL } from "./journey";
import type { Decision, DoseLog, EffectLog, Profile, StackItem } from "./types";

/**
 * Your journey as one path: what's behind you (starts, dose steps, milestones you reached,
 * the day you felt something, decisions) and what's ahead, with dates.
 */
export type PathEvent = {
  date: string;
  title: string;
  detail?: string;
  kind: "join" | "start" | "dose" | "milestone" | "felt" | "decision" | "stop" | "arrive";
};

const VERDICT: Record<string, string> = {
  worked: "it worked",
  "no-effect": "no effect",
  "side-effects": "side effects",
  other: "stopped",
};

export function journeyPath(input: {
  stack: StackItem[];
  logs: DoseLog[];
  effects: EffectLog[];
  decisions: Decision[];
  profile: Pick<Profile, "installedAt" | "joinedAt">;
  today: string;
}): { ahead: PathEvent[]; behind: PathEvent[] } {
  const { stack, logs, effects, decisions, profile, today } = input;
  const behind: PathEvent[] = [];
  const ahead: PathEvent[] = [];
  const started = profile.installedAt ?? profile.joinedAt;
  if (started) behind.push({ date: started, title: "Started with Supplime", kind: "join" });

  for (const item of stack) {
    if (item.planned) {
      if (item.stage === "ordered" && item.arrivesOn && item.arrivesOn >= today)
        ahead.push({
          date: item.arrivesOn,
          title: `${item.name} arrives`,
          detail: "Roughly, as you entered it",
          kind: "arrive",
        });
      continue;
    }
    const first = item.doseHistory[0];
    behind.push({
      date: item.startedAt,
      title: `Started ${item.name}`,
      detail: first ? `${first.amount} ${first.unit}` : undefined,
      kind: "start",
    });
    item.doseHistory.slice(1).forEach((step, i) => {
      const prev = item.doseHistory[i]!;
      behind.push({
        date: step.date,
        title: `${item.name}: ${step.amount > prev.amount ? "up" : "down"} to ${step.amount} ${step.unit}`,
        detail: `from ${prev.amount} ${prev.unit}`,
        kind: "dose",
      });
    });
    if (item.archived) {
      behind.push({
        date: item.archived.date,
        title: `Stopped ${item.name}`,
        detail: VERDICT[item.archived.verdict],
        kind: "stop",
      });
      continue;
    }
    if (item.paused) continue;
    const j = journeyFor({ item, logs, effects, decisions, today });
    if (j.felt) {
      behind.push({
        date: j.felt.log.date,
        title: `Felt ${item.name} working`,
        detail: `day ${j.felt.day}`,
        kind: "felt",
      });
    }
    for (const m of j.milestones) {
      if (m.key === "start") continue;
      if (m.reached && m.date <= today) {
        if (m.key === "evaluate") continue;
        behind.push({
          date: m.date,
          title: `${item.name}: ${m.label.toLowerCase()}`,
          detail: `day ${m.day}`,
          kind: "milestone",
        });
      } else if (!m.reached) {
        ahead.push({
          date: m.date > today ? m.date : today,
          title: `${item.name}: ${m.label.toLowerCase()}`,
          detail:
            m.key === "evaluate" && j.streakGoal
              ? `${j.streakGoal.done} of ${STREAK_GOAL} days in a row so far`
              : `day ${m.day}`,
          kind: "milestone",
        });
      }
    }
  }
  for (const d of decisions) {
    const item = stack.find((i) => i.id === d.itemId);
    if (!item || d.kind === "stop" || d.kind === "step-up" || d.kind === "lower") continue;
    behind.push({
      date: d.date,
      title: d.kind === "keep" ? `Kept ${item.name}` : `Gave ${item.name} more time`,
      kind: "decision",
    });
  }
  behind.sort((a, b) => b.date.localeCompare(a.date));
  ahead.sort((a, b) => a.date.localeCompare(b.date));
  return { ahead, behind };
}
