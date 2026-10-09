/**
 * Windows follow your day, not the clock: "First meal" is whenever you first eat, even if
 * that is 1 pm. The ids stay the same as v1 so old data keeps working.
 */
export const SLOTS = [
  { id: "wake", label: "On waking", hint: "Empty stomach, before food", defaultTime: "07:00" },
  { id: "breakfast", label: "First meal", hint: "Whenever you first eat", defaultTime: "08:00" },
  { id: "lunch", label: "Second meal", hint: "Your next meal", defaultTime: "12:30" },
  { id: "afternoon", label: "Afternoon", hint: "Between meals", defaultTime: "15:30" },
  { id: "dinner", label: "Last meal", hint: "Your final meal of the day", defaultTime: "19:00" },
  { id: "bed", label: "Before bed", hint: "Wind-down", defaultTime: "22:30" },
] as const;

/** Windows that move when you tap "I'm up" later than planned. */
export const WAKE_RELATIVE: readonly SlotId[] = ["wake", "breakfast", "lunch", "afternoon"];

export type SlotId = (typeof SLOTS)[number]["id"];

export const FOOD_TIMINGS = ["empty", "with", "after", "any"] as const;
export type FoodTiming = (typeof FOOD_TIMINGS)[number];

export const CATEGORIES = [
  "nootropic",
  "adaptogen",
  "vitamin",
  "mineral",
  "amino",
  "omega",
  "gut",
  "sleep",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];

export const GOALS = [
  { id: "focus", label: "Focus & memory" },
  { id: "calm", label: "Calm & stress" },
  { id: "sleep", label: "Sleep" },
  { id: "energy", label: "Energy" },
  { id: "mood", label: "Mood" },
  { id: "recovery", label: "Recovery" },
  { id: "immunity", label: "Immunity" },
  { id: "longevity", label: "Long-term health" },
] as const;
export type GoalId = (typeof GOALS)[number]["id"];

export type CatalogItem = {
  id: string;
  name: string;
  aliases: string[];
  category: Category;
  summary: string;
  typicalDose: string;
  defaultAmount: number;
  unit: string;
  foodTiming: FoodTiming;
  foodWhy: string;
  preferredSlots: SlotId[];
  onset: {
    kind: "acute" | "cumulative";
    minutes?: { min: number; max: number };
    days: { min: number; max: number };
    note: string;
  };
  increaseAfterDays: number;
  increaseGuidance: string;
  typicalCeiling: string;
  synergies: string[];
  avoidWith: string[];
  caution: string;
};

export type StackItem = {
  id: string;
  catalogId: string | null;
  name: string;
  amount: number;
  unit: string;
  foodTiming: FoodTiming;
  slots: SlotId[];
  notes: string;
  servingsRemaining: number;
  servingsPerContainer: number;
  servingsPerDose: number;
  reorderAtDays: number;
  startedAt: string;
  paused: boolean;
  /** Every dose level you have run, oldest first. The last entry is the current dose. */
  doseHistory: DoseStep[];
  /** Your own numbers when the guide doesn't know the product, or you know better. */
  overrides?: ItemOverrides;
  /** Set when you stop taking it. History is kept and shown under past experiments. */
  archived?: { date: string; verdict: Verdict; note?: string };
  /** Where it came from, e.g. an iHerb product. */
  source?: { url?: string; brand?: string; title?: string };
  /** Capsule/tablet strength, so "1 capsule = 200 mg" stays visible. */
  servingLabel?: string;
  /**
   * The actual bottle: what one pill contains. When set, the dose is "pills per dose"
   * (servingsPerDose) and `amount` = pills × dosePerUnit.
   */
  product?: ItemProduct;
  /** In your cabinet but not started yet: no reminders, offered as a next experiment. */
  planned?: boolean;
  /**
   * Before it's in your cabinet: just reading about it ("interested") or bought and on its
   * way ("ordered"). Both are also `planned`, so they never show on Today.
   */
  stage?: "interested" | "ordered";
  /** For an ordered bottle: roughly when it arrives. */
  arrivesOn?: string;
  /** You set your own reorder warning for this bottle (otherwise it follows Settings). */
  reorderCustom?: boolean;
  /** Food options you're fine with (defaults from the guide). */
  foodOk?: FoodTiming[];
  /**
   * A dose change that starts on a later day (you'd already taken today's dose when you
   * decided). Applied automatically on `date`.
   */
  pendingDose?: PendingDose;
};

export type PendingDose = {
  date: string;
  kind: "step-up" | "lower";
  amount: number;
  /** Pills per dose at the new dose. */
  units: number;
  /** Switching to a new bottle as part of the change. */
  product?: ItemProduct;
  bottle?: number;
};

export type ItemProduct = {
  id?: string;
  brand: string;
  name: string;
  form: "capsule" | "veg capsule" | "softgel" | "tablet" | "lozenge" | "scoop";
  perUnit: { name: string; amount: number; unit: string }[];
  dosePerUnit: number;
  labelServing?: number;
  labelUse?: string;
};

/** A periodic "any side effects?" check. */
export type SafetyCheck = {
  id: string;
  itemId: string;
  date: string;
  /** Symptoms you ticked; empty = all good. */
  symptoms: string[];
};

export type Verdict = "worked" | "no-effect" | "side-effects" | "other";

export type ItemOverrides = {
  /** Days until you might first notice it. */
  firstSignsDay?: number;
  /** Days until most people notice it. */
  typicalDay?: number;
  /** Do not change the dose before this many days at it. */
  minDaysBeforeIncrease?: number;
  /** Day to decide keep / adjust / stop. */
  evaluateDay?: number;
  rules?: HabitRule[];
  missed?: MissedMode;
};

export type RuleKind =
  | "needs-food"
  | "needs-fat"
  | "empty-stomach"
  | "avoid-caffeine"
  | "pairs-caffeine"
  | "avoid-alcohol"
  | "stimulating"
  | "drowsy"
  | "separate";

export type HabitRule = {
  kind: RuleKind;
  /** Hours of spacing for avoid-* and separate rules. */
  hours?: number;
  text: string;
  /** For "separate": the other supplements by catalog id. */
  with?: string[];
};

/**
 * What to do when a dose is missed:
 * - catch-up: take it later today (with food if it needs food), never double tomorrow
 * - morning-only: catch up only until early afternoon (stimulating)
 * - bedtime-only: only around bedtime; otherwise skip (sleep aids)
 * - optional: an as-needed effect; take it only if you want it now
 */
export type MissedMode = "catch-up" | "morning-only" | "bedtime-only" | "optional";

export type DoseStep = {
  date: string;
  amount: number;
  unit: string;
};

/** 0 = nothing yet, 1 = maybe, 2 = noticeable, 3 = clear effect */
export type EffectRating = 0 | 1 | 2 | 3;

export type EffectLog = {
  id: string;
  itemId: string;
  date: string;
  rating: EffectRating;
  note?: string;
  sideEffects?: boolean;
  /** What the check-in was about, e.g. "focus" or "sleep-onset". */
  area?: string;
};

export type DoseStatus = "taken" | "skipped" | "missed" | "deferred";

export type MissReason = "forgot" | "not-with-me" | "chose" | "side-effects";

export type DoseLog = {
  id: string;
  itemId: string;
  date: string;
  slot: SlotId;
  status: DoseStatus;
  at: string;
  /** Taken well after its window (a catch-up). */
  late?: boolean;
  reason?: MissReason;
  /** For a deferred dose: when to remind (HH:MM, same day). */
  remindAt?: string;
  /** Reconstructed from "I've been taking it since…" rather than logged on the day. */
  backfill?: boolean;
  /** Fixed later from the history editor (counts like history, not a live dose). */
  edited?: boolean;
  /** Marked "I was away": a pause, not counted against consistency. */
  away?: boolean;
};

/** Things about one particular day: when you actually got up, coffee, a drink. */
export type DayContext = {
  date: string;
  wokeAt?: string;
  /** Where the wake time came from: you, your watch, or your first log of the day. */
  wakeSource?: "tap" | "watch" | "inferred";
  coffeeAt?: string[];
  alcoholAt?: string[];
  /** Meals you logged today (HH:MM). */
  mealsAt?: string[];
};

export type DecisionKind = "keep" | "step-up" | "lower" | "stop" | "more-time";

export type Decision = {
  id: string;
  itemId: string;
  date: string;
  kind: DecisionKind;
  /** Dose before the decision. */
  from?: number;
  to?: number;
  note?: string;
};

export type BodyLog = {
  date: string;
  sleepHours?: number;
  sleepScore?: number;
  restingHr?: number;
  hrv?: number;
  steps?: number;
  /** Deep and REM sleep that night (minutes), from sleep stages. */
  deepMin?: number;
  remMin?: number;
  /** Exercise minutes that day. */
  activeMin?: number;
  /** Average blood oxygen (%). */
  spo2?: number;
  energy?: number;
  mood?: number;
  focus?: number;
  /** Calm vs. stress: 1 = very stressed, 5 = calm (higher is better, like the others). */
  calm?: number;
  notes?: string;
  source: "manual" | "fitbit";
};

export type SlotTimes = Record<SlotId, string>;

export type BadgeId =
  | "first-dose"
  | "week-streak"
  | "habit"
  | "perfect-week"
  | "stock-steward"
  | "signal-keeper"
  | "onset"
  | "felt-it"
  | "history"
  | "fair-test"
  | "verdict"
  | "safety-first"
  | "one-at-a-time"
  | "linked";

export type Rhythm = {
  wake: string;
  /** null = you don't eat until later; first meal time is then `firstMeal`. */
  eatsBreakfast: boolean;
  firstMeal: string;
  lastMeal: string;
  bed: string;
  /** Usually home by: used for "not with me" catch-ups. */
  home: string;
  /** Wake time varies: morning reminders wait until you tap "I'm up". */
  flexibleWake: boolean;
};

export type Habits = {
  coffee: boolean;
  coffeeTime: string;
  alcohol: "never" | "sometimes" | "often";
};

export type Profile = {
  displayName: string;
  /** Your reason for doing this, shown on Today. */
  why: string;
  goals: GoalId[];
  onboarded: boolean;
  notifications: boolean;
  reminderLeadMinutes: number;
  slotTimes: SlotTimes;
  badges: BadgeId[];
  lastCoachAt?: string;
  lastCoach?: CoachResult | null;
  /** Optional xAI key for the coach. Stays on this phone. */
  coachKey?: string;
  coachModel?: string;
  /** Re-ping this many minutes after a window if nothing was logged. 0 = off. */
  nagMinutes: number;
  rhythm: Rhythm;
  habits: Habits;
  /** Share of planned doses you aim for each week (0.5–1). */
  weeklyTarget: number;
  /** Insight cards you have unlocked. */
  facts: string[];
  /** First day in Supplime. Streaks and weekly targets start here, not at backdated start dates. */
  joinedAt?: string;
  /** The day you installed Supplime (never moves; full-day XP only counts from here). */
  installedAt?: string;
  /** Warn this many days before a bottle runs out (covers shipping). */
  reorderLeadDays: number;
  /** How the coach runs: share to the Claude/Gemini app, or an API key. */
  coachProvider?: "share" | "gemini" | "xai";
  geminiKey?: string;
  /** Your saved coach answers (pasted back from Claude / Gemini). */
  coachNotes?: { date: string; text: string; source: string }[];
  /** Health Connect (Fitbit / Google Health) sync. */
  healthSync?: { enabled: boolean; lastSync?: string; scope?: number };
  /** Evening "how was your day?" reminder (on unless you turn it off). */
  feelReminder?: { enabled: boolean; time?: string };
};

export type CoachResult = {
  summary: string;
  timing: string[];
  dosage: string[];
  ideas: { name: string; why: string; caution: string }[];
  bodyNotes: string[];
};

export type PersistedData = {
  profile: Profile;
  stack: StackItem[];
  logs: DoseLog[];
  body: BodyLog[];
  effects: EffectLog[];
  days: DayContext[];
  decisions: Decision[];
  checks: SafetyCheck[];
};
