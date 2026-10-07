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
};

/** Things about one particular day: when you actually got up, coffee, a drink. */
export type DayContext = {
  date: string;
  wokeAt?: string;
  coffeeAt?: string[];
  alcoholAt?: string[];
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
  energy?: number;
  mood?: number;
  focus?: number;
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
  | "felt-it";

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
};
