export const SLOTS = [
  { id: "wake", label: "On waking", hint: "Empty-stomach window", defaultTime: "07:00" },
  { id: "breakfast", label: "Breakfast", hint: "With morning food", defaultTime: "08:00" },
  { id: "lunch", label: "Lunch", hint: "Midday meal", defaultTime: "12:30" },
  { id: "afternoon", label: "Afternoon", hint: "Between meals", defaultTime: "15:30" },
  { id: "dinner", label: "Dinner", hint: "Evening meal", defaultTime: "19:00" },
  { id: "bed", label: "Before bed", hint: "Wind-down", defaultTime: "21:30" },
] as const;

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
};

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
};

export type DoseStatus = "taken" | "skipped" | "missed";

export type DoseLog = {
  id: string;
  itemId: string;
  date: string;
  slot: SlotId;
  status: DoseStatus;
  at: string;
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

export type Profile = {
  displayName: string;
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
};
