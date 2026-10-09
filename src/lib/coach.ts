import { Share } from "@capacitor/share";
import { advise, beforeAfter, fmtDose, recentSymptoms } from "./advisor";
import { journeyFor } from "./journey";
import { AREA_COPY, AREA_LABEL, profileFor } from "./knowledge";
import { isNative } from "./platform";
import { bodyAverages, effectHistory } from "./stats";
import type { PersistedData } from "./types";
import { SLOTS } from "./types";
import { formatClock } from "./utils";

/**
 * The coach doesn't need a paid API. Supplime writes a complete briefing of your stack
 * and data, and you send it to the Claude or Gemini app you already pay for (or use
 * Gemini's free API tier). Paste the answer back and it's kept in your journey.
 */

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const DEFAULT_COACH_MODEL = "grok-4.5";

export function buildCoachPrompt(state: PersistedData, today: string) {
  const { profile, stack, logs, effects, decisions, checks, body } = state;
  const active = stack.filter((i) => !i.archived && !i.paused && !i.planned);
  const planned = stack.filter((i) => i.planned);
  const slotLabel = (id: string) => SLOTS.find((s) => s.id === id)?.label ?? id;
  const a = advise({ stack, logs, effects, decisions, checks, profile, today });
  const avg = bodyAverages(body, 14, today);

  const lines: string[] = [];
  lines.push(
    "You're my supplement coach. Be practical and conservative; you're not my doctor and I know that. Use my data below.",
    "",
    `About me: goals ${profile.goals.join(", ") || "not set"}${profile.why ? `; my why: "${profile.why}"` : ""}.`,
    `My day: up ${formatClock(profile.rhythm.wake)}${profile.rhythm.flexibleWake ? " (varies)" : ""}, first meal ${formatClock(profile.rhythm.firstMeal)}, last meal ${formatClock(profile.rhythm.lastMeal)}, bed ${formatClock(profile.rhythm.bed)}. Coffee: ${profile.habits.coffee ? `yes, ~${formatClock(profile.habits.coffeeTime)}` : "no"}. Alcohol: ${profile.habits.alcohol}.`,
    "",
    "What I take:",
  );
  for (const item of active) {
    const j = journeyFor({ item, logs, effects, decisions, today });
    const p = profileFor(item);
    const checkIns = effectHistory(item, effects)
      .slice(-6)
      .map((e) => `${e.date} ${AREA_LABEL[e.area ?? ""] ?? "overall"}: ${AREA_COPY[e.rating]}`)
      .join("; ");
    const symptoms = recentSymptoms(item, checks, today);
    lines.push(
      `- ${item.name}${item.product ? ` (${item.product.brand} ${item.product.name})` : ""}: ${fmtDose(item, item.amount)} ${item.slots.map(slotLabel).join(" + ")}. Day ${j.day}, ${j.atDose} days at this dose, consistency ${j.consistency === null ? "unknown" : `${Math.round(j.consistency * 100)}%`}. Typical onset ~day ${p.typicalDay}.`,
      `  Check-ins: ${checkIns || "none yet"}. Side effects: ${symptoms.length ? symptoms.join(", ") : "none reported"}.`,
    );
    for (const d of beforeAfter(item, body, today)) {
      lines.push(`  Wearable ${d.metric}: ${d.before} before → ${d.after} since starting.`);
    }
  }
  const owned = planned.filter((i) => !i.stage);
  const ordered = planned.filter((i) => i.stage === "ordered");
  const curious = planned.filter((i) => i.stage === "interested");
  if (owned.length)
    lines.push(`Owned but not started yet: ${owned.map((i) => i.name).join(", ")}.`);
  if (ordered.length)
    lines.push(
      `Ordered, arriving soon: ${ordered.map((i) => `${i.name}${i.arrivesOn ? ` (~${i.arrivesOn})` : ""}`).join(", ")}.`,
    );
  if (curious.length)
    lines.push(`Considering: ${curious.map((i) => i.name).join(", ")}. Is it a good idea for me?`);
  if (avg.count) {
    lines.push(
      "",
      `Last 14 days from my wearable: sleep ${avg.sleepHours?.toFixed(1) ?? "?"} h, resting HR ${avg.restingHr ? Math.round(avg.restingHr) : "?"}, HRV ${avg.hrv ? Math.round(avg.hrv) : "?"}.`,
    );
  }
  lines.push(
    "",
    `My app's current read: ${a.increases.map((x) => `could raise ${x.item.name} to ${fmtDose(x.item, x.to)}`).join("; ") || "no dose increases due"}; ${a.reconsider.map((r) => `${r.item.name}: ${r.title}`).join("; ") || "nothing to reconsider"}; next new supplement ${a.slotOpen ? "can start now" : `after ${a.slotOpensOn}`}.`,
    "",
    "Please answer briefly, in four parts:",
    "1. Timing: anything I should move (food, coffee, bedtime)?",
    "2. Doses: what's ready to increase, what to keep, what to lower — and why.",
    "3. Next: the ONE supplement worth adding next for my goals, and when.",
    "4. Watch-outs: side effects or interactions I should keep an eye on.",
  );
  return lines.join("\n");
}

/** Hand the briefing to the Claude or Gemini app via the share sheet (or copy it). */
export async function shareToAssistant(prompt: string): Promise<"shared" | "copied"> {
  if (isNative()) {
    await Share.share({
      title: "Ask my coach",
      text: prompt,
      dialogTitle: "Open in Claude or Gemini",
    });
    return "shared";
  }
  await navigator.clipboard.writeText(prompt);
  return "copied";
}

/** Gemini's free API tier (key from aistudio.google.com). */
export async function askGemini(prompt: string, key: string, model = DEFAULT_GEMINI_MODEL) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key.trim())}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: prompt }] }] }),
    },
  );
  if (!res.ok) {
    throw new Error(
      res.status === 400 || res.status === 403
        ? "The Gemini key was rejected."
        : `Gemini request failed (${res.status}).`,
    );
  }
  const body = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  if (!text.trim()) throw new Error("Gemini sent an empty answer.");
  return text.trim();
}

/** xAI (Grok) with your own key. */
export async function askGrok(prompt: string, key: string, model = DEFAULT_COACH_MODEL) {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key.trim()}` },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok)
    throw new Error(
      res.status === 401 || res.status === 403
        ? "The xAI key was rejected."
        : `Grok request failed (${res.status}).`,
    );
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return (body.choices?.[0]?.message?.content ?? "").trim();
}
