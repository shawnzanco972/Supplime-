import type { CoachResult } from "./types";

export type CoachInput = {
  name: string;
  goals: string[];
  stack: {
    name: string;
    amount: number;
    unit: string;
    foodTiming: string;
    slots: string[];
    daysOn: number;
    daysAtCurrentDose: number;
    daysActuallyTaken: number;
    doseHistory: { date: string; amount: number; unit: string }[];
    effectCheckIns: { date: string; rating: string; note?: string }[];
    daysLeft: number;
  }[];
  adherence7: number;
  streak: number;
  body: {
    sleepHours: number | null;
    sleepScore: number | null;
    restingHr: number | null;
    hrv: number | null;
    energy: number | null;
    mood: number | null;
    focus: number | null;
  };
};

export const DEFAULT_COACH_MODEL = "grok-4.5";

/**
 * Runs on the phone with your own xAI key (the Grok version needed a server for this).
 * Capacitor routes fetch through native HTTP, so there is no CORS problem in the APK.
 */
export async function askCoach(
  data: CoachInput,
  apiKey: string,
  model = DEFAULT_COACH_MODEL,
): Promise<{ ok: true; result: CoachResult } | { ok: false; error: string }> {
  if (!apiKey.trim())
    return { ok: false, error: "Add your xAI API key in Settings to use the coach." };
  let res: Response;
  try {
    res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey.trim()}` },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 900,
        messages: [
          {
            role: "system",
            content:
              "You are a careful supplement timing coach inside an app called Supplime. You are not a doctor. Never diagnose or prescribe. Give practical, conservative advice about timing with food, when effects typically show, and whether a dose increase is reasonable or premature. Use the user's real data: days at the current dose, days actually taken (missed days delay effects), dose history, and their own effect check-ins. If they already feel a clear effect, say there is no reason to increase. Mention stock only if a bottle is low. Prefer well-studied basics over trendy stacks. Flag interactions at a high level. Return STRICT JSON with keys: summary (string, 2 sentences), timing (string[] max 4), dosage (string[] max 4), ideas (array of {name, why, caution} max 3), bodyNotes (string[] max 3). No markdown.",
          },
          { role: "user", content: JSON.stringify(data) },
        ],
      }),
    });
  } catch {
    return { ok: false, error: "No connection to the coach. Check your internet." };
  }
  if (!res.ok) {
    return {
      ok: false,
      error:
        res.status === 401 || res.status === 403
          ? "The xAI key was rejected."
          : `Coach request failed (${res.status}).`,
    };
  }
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = body.choices?.[0]?.message?.content ?? "";
  const jsonText = text.trim().replace(/^```json\s*|\s*```$/g, "");
  try {
    const parsed = JSON.parse(jsonText) as CoachResult;
    return {
      ok: true,
      result: {
        summary: String(parsed.summary ?? ""),
        timing: Array.isArray(parsed.timing) ? parsed.timing.map(String).slice(0, 4) : [],
        dosage: Array.isArray(parsed.dosage) ? parsed.dosage.map(String).slice(0, 4) : [],
        ideas: Array.isArray(parsed.ideas)
          ? parsed.ideas.slice(0, 3).map((idea) => ({
              name: String(idea?.name ?? ""),
              why: String(idea?.why ?? ""),
              caution: String(idea?.caution ?? ""),
            }))
          : [],
        bodyNotes: Array.isArray(parsed.bodyNotes) ? parsed.bodyNotes.map(String).slice(0, 3) : [],
      },
    };
  } catch {
    return { ok: false, error: "Could not read the coach response." };
  }
}
