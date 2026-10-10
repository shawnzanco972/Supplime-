import { CATALOG_BY_ID } from "./catalog";
import { matchCatalog, norm } from "./iherb";
import type { BackfillPattern } from "./advisor";
import type { NewItem } from "./store";
import { GOALS, SLOTS, type GoalId, type Habits, type Rhythm, type SlotId } from "./types";

/**
 * "Set up with your AI": Supplime hands a prompt to Claude or Gemini, the assistant asks a
 * few questions, then answers with one JSON block that we read back here. Nothing is sent
 * anywhere by Supplime itself; the person copies the answer back in.
 */
export function setupPrompt(today: string) {
  const slots = SLOTS.map((s) => `"${s.id}" (${s.label.toLowerCase()})`).join(", ");
  const goals = GOALS.map((g) => `"${g.id}"`).join(", ");
  return `You're helping me set up Supplime, a supplement tracker app. Ask me a few quick questions, then write a setup block I'll paste back into the app.

Rules for the questions:
- At most 4 questions, one per message, each one or two short lines. No long lists, no explanations.
  1. My first name, and in a few words why I take supplements.
  2. My usual day: wake-up time (and whether it varies a lot), first meal, last meal, bedtime.
  3. Coffee (yes/no, roughly when) and alcohol (never / sometimes / often).
  4. What I take now: I'll list them roughly (name, dose, when, since when, how regularly).
- Accept short, rough answers. Don't ask follow-ups; make sensible guesses and mention them in the summary.
- If I say I don't take anything yet, skip question 4.
- No medical advice and no product suggestions.

When you're done, reply with a short summary and then ONLY this JSON in one code block (today is ${today}):

\`\`\`json
{
  "supplime": 1,
  "name": "first name",
  "why": "one short line in my words",
  "goals": [one or more of ${goals}],
  "rhythm": { "wake": "HH:MM", "wakeVaries": true|false, "eatsBreakfast": true|false, "firstMeal": "HH:MM", "lastMeal": "HH:MM", "bed": "HH:MM" },
  "habits": { "coffee": true|false, "coffeeTime": "HH:MM", "alcohol": "never"|"sometimes"|"often" },
  "supplements": [
    { "name": "Lion's Mane", "brand": "optional", "amount": 500, "unit": "mg", "perDay": 2, "times": [from ${slots}], "since": "YYYY-MM-DD", "consistency": "every"|"most"|"some" }
  ]
}
\`\`\`

"amount" is per dose (one serving), not per day. Use 24-hour times. Keep the summary to 3 lines. Start right away with question 1.`;
}

export type SetupImport = {
  name?: string;
  why?: string;
  goals: GoalId[];
  rhythm: Partial<Rhythm>;
  habits: Partial<Habits>;
  items: NewItem[];
  /** Names Supplime doesn't have a guide for (added as custom). */
  custom: string[];
};

const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const time = (v: unknown) => {
  const m = typeof v === "string" ? v.trim().match(TIME) : null;
  return m ? `${m[1]!.padStart(2, "0")}:${m[2]}` : undefined;
};
const str = (v: unknown, max = 80) =>
  typeof v === "string" && v.trim() ? v.trim().slice(0, max) : undefined;

/** Pull the JSON object out of whatever the assistant wrote around it. */
function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidates = [fenced, text].filter((x): x is string => !!x);
  for (const c of candidates) {
    const start = c.indexOf("{");
    const end = c.lastIndexOf("}");
    if (start < 0 || end <= start) continue;
    const raw = c
      .slice(start, end + 1)
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(raw);
    } catch {
      // try the next candidate
    }
  }
  return null;
}

/** Read an assistant's setup block. Returns null if there's nothing usable in it. */
export function parseSetup(text: string, today: string): SetupImport | null {
  const data = extractJson(text) as Record<string, unknown> | null;
  if (!data || typeof data !== "object") return null;
  const r = (data.rhythm ?? {}) as Record<string, unknown>;
  const h = (data.habits ?? {}) as Record<string, unknown>;
  const goalIds = new Set<string>(GOALS.map((g) => g.id));
  const slotIds = new Set<string>(SLOTS.map((s) => s.id));

  const rhythm: Partial<Rhythm> = {};
  for (const k of ["wake", "firstMeal", "lastMeal", "bed"] as const) {
    const t = time(r[k]);
    if (t) rhythm[k] = t;
  }
  if (typeof r.eatsBreakfast === "boolean") rhythm.eatsBreakfast = r.eatsBreakfast;
  if (typeof r.wakeVaries === "boolean") rhythm.flexibleWake = r.wakeVaries;

  const habits: Partial<Habits> = {};
  if (typeof h.coffee === "boolean") habits.coffee = h.coffee;
  const ct = time(h.coffeeTime);
  if (ct) habits.coffeeTime = ct;
  if (h.alcohol === "never" || h.alcohol === "sometimes" || h.alcohol === "often")
    habits.alcohol = h.alcohol;

  const custom: string[] = [];
  const seen = new Set<string>();
  const items: NewItem[] = [];
  for (const raw of Array.isArray(data.supplements) ? data.supplements : []) {
    const s = (raw ?? {}) as Record<string, unknown>;
    const name = str(s.name);
    if (!name) continue;
    const catalogId = matchCatalog(norm(name)) ?? null;
    const key = catalogId ?? norm(name);
    if (seen.has(key)) continue;
    seen.add(key);
    const def = catalogId ? CATALOG_BY_ID[catalogId] : undefined;
    let slots = (Array.isArray(s.times) ? s.times : []).filter(
      (t): t is SlotId => typeof t === "string" && slotIds.has(t),
    );
    slots = [...new Set(slots)];
    const perDay = typeof s.perDay === "number" ? Math.round(s.perDay) : 0;
    if (!slots.length && def) slots = def.preferredSlots.slice(0, Math.max(1, perDay || 1));
    const amount = typeof s.amount === "number" && s.amount > 0 ? s.amount : undefined;
    const unit = str(s.unit, 12);
    const since = typeof s.since === "string" && DATE.test(s.since) ? s.since : undefined;
    const startedAt = since && since <= today ? since : today;
    const pattern: BackfillPattern =
      s.consistency === "most" || s.consistency === "some" ? s.consistency : "every";
    const brand = str(s.brand);
    if (!def) custom.push(name);
    items.push({
      catalogId,
      name: def ? undefined : name,
      amount,
      unit: amount ? (unit ?? def?.unit) : undefined,
      slots: slots.length ? slots : undefined,
      startedAt,
      backfill: startedAt < today ? pattern : undefined,
      source: brand ? { brand } : undefined,
    });
  }

  const result: SetupImport = {
    name: str(data.name, 40),
    why: str(data.why, 120),
    goals: (Array.isArray(data.goals) ? data.goals : []).filter(
      (g): g is GoalId => typeof g === "string" && goalIds.has(g),
    ),
    rhythm,
    habits,
    items,
    custom,
  };
  const empty =
    !result.name &&
    !result.why &&
    !items.length &&
    !Object.keys(rhythm).length &&
    !Object.keys(habits).length;
  return empty ? null : result;
}

/** A shared text that is (probably) a setup block, not a product link. */
export function looksLikeSetup(text: string) {
  return /"supplime"\s*:/.test(text) || /"supplements"\s*:\s*\[/.test(text);
}
