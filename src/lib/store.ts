import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { CATALOG_BY_ID } from "./catalog";
import { defaultRhythm, logicalDate, slotTimesFromRhythm } from "./protocol";
import { earnedBadges } from "./stats";
import type {
  BadgeId,
  BodyLog,
  CoachResult,
  DayContext,
  Decision,
  DecisionKind,
  DoseLog,
  DoseStatus,
  EffectLog,
  EffectRating,
  FoodTiming,
  GoalId,
  Habits,
  ItemOverrides,
  MissReason,
  PersistedData,
  Profile,
  Rhythm,
  SlotId,
  StackItem,
  Verdict,
} from "./types";
import { uid } from "./utils";

export const defaultHabits = (): Habits => ({
  coffee: true,
  coffeeTime: "08:30",
  alcohol: "sometimes",
});

const defaultProfile = (): Profile => {
  const rhythm = defaultRhythm();
  return {
    displayName: "",
    why: "",
    goals: [],
    onboarded: false,
    notifications: false,
    reminderLeadMinutes: 10,
    slotTimes: slotTimesFromRhythm(rhythm),
    badges: [],
    lastCoach: null,
    nagMinutes: 30,
    rhythm,
    habits: defaultHabits(),
    weeklyTarget: 0.85,
    facts: [],
  };
};

export type NewItem = {
  catalogId?: string | null;
  name?: string;
  amount?: number;
  unit?: string;
  foodTiming?: FoodTiming;
  slots?: SlotId[];
  startedAt?: string;
  servingsPerContainer?: number;
  servingLabel?: string;
  overrides?: ItemOverrides;
  source?: StackItem["source"];
};

/** An edit made in the item editor, saved in one go. */
export type ItemDraft = Partial<
  Pick<
    StackItem,
    | "name"
    | "unit"
    | "foodTiming"
    | "slots"
    | "notes"
    | "servingsRemaining"
    | "servingsPerContainer"
    | "servingsPerDose"
    | "reorderAtDays"
    | "startedAt"
    | "paused"
    | "overrides"
    | "servingLabel"
  >
> & {
  amount?: number;
  /** new-step: you changed the dose from today. correction: the dose was entered wrong. */
  doseChange?: "new-step" | "correction";
};

type SupplimeStore = PersistedData & {
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  completeOnboarding: (input: {
    displayName: string;
    why: string;
    goals: GoalId[];
    rhythm: Rhythm;
    habits: Habits;
    items: NewItem[];
    notifications: boolean;
  }) => void;
  addItem: (input: NewItem) => string | null;
  addFromCatalog: (catalogId: string) => string | null;
  saveItem: (id: string, draft: ItemDraft) => void;
  updateItem: (id: string, patch: Partial<StackItem>) => void;
  changeDose: (id: string, amount: number, unit?: string, date?: string) => void;
  archiveItem: (id: string, verdict: Verdict, note?: string) => void;
  restoreItem: (id: string) => void;
  removeItem: (id: string) => void;
  refill: (id: string, servings?: number) => void;
  logDose: (
    itemId: string,
    slot: SlotId,
    status: DoseStatus,
    date?: string,
    extra?: Pick<DoseLog, "late" | "reason" | "remindAt">,
  ) => void;
  deferDose: (
    itemId: string,
    slot: SlotId,
    remindAt: string,
    reason: MissReason,
    date?: string,
  ) => void;
  undoDose: (itemId: string, slot: SlotId, date?: string) => void;
  logEffect: (
    itemId: string,
    rating: EffectRating,
    opts?: { note?: string; sideEffects?: boolean; date?: string },
  ) => void;
  removeEffect: (id: string) => void;
  decide: (
    itemId: string,
    kind: DecisionKind,
    opts?: { to?: number; note?: string; verdict?: Verdict },
  ) => void;
  setDay: (date: string, patch: Partial<Omit<DayContext, "date">>) => void;
  revealFact: (factId: string, date?: string) => void;
  setRhythm: (rhythm: Rhythm) => void;
  setProfile: (patch: Partial<Profile>) => void;
  importData: (data: unknown) => boolean;
  logBody: (entry: BodyLog) => void;
  importBody: (entries: BodyLog[]) => void;
  setNotifications: (value: boolean) => void;
  setSlotTime: (slot: SlotId, time: string) => void;
  setCoach: (result: CoachResult) => void;
  resetAll: () => void;
};

/** "Today" in your rhythm: after midnight but before you'd normally be up still counts as yesterday. */
export function appToday(): string {
  return logicalDate(new Date(), useSupplime.getState().profile.rhythm);
}

function newItem(input: NewItem): StackItem | null {
  const def = input.catalogId ? CATALOG_BY_ID[input.catalogId] : undefined;
  const name = input.name?.trim() || def?.name;
  if (!name) return null;
  const amount = input.amount ?? def?.defaultAmount ?? 1;
  const unit = input.unit ?? def?.unit ?? "mg";
  const startedAt = input.startedAt ?? appToday();
  const count = input.servingsPerContainer ?? 60;
  return {
    id: uid(),
    catalogId: def?.id ?? null,
    name,
    amount,
    unit,
    foodTiming: input.foodTiming ?? def?.foodTiming ?? "any",
    slots: input.slots?.length ? input.slots : def ? [...def.preferredSlots] : ["breakfast"],
    notes: "",
    servingsRemaining: count,
    servingsPerContainer: count,
    servingsPerDose: 1,
    reorderAtDays: 10,
    startedAt,
    paused: false,
    doseHistory: [{ date: startedAt, amount, unit }],
    overrides: input.overrides,
    source: input.source,
    servingLabel: input.servingLabel,
  };
}

/** Fill gaps in data from older versions or a hand-edited backup. */
function normalizeItem(item: StackItem): StackItem {
  const history =
    Array.isArray(item.doseHistory) && item.doseHistory.length > 0
      ? item.doseHistory
      : [{ date: item.startedAt, amount: item.amount, unit: item.unit }];
  return { ...item, doseHistory: history };
}

export function normalizeData(raw: Partial<PersistedData>): PersistedData {
  const base = defaultProfile();
  const old = raw.profile;
  // v1/v2 had slot times but no rhythm: derive one so nothing moves.
  const rhythm: Rhythm = old?.rhythm ?? {
    ...base.rhythm,
    ...(old?.slotTimes
      ? {
          wake: old.slotTimes.wake,
          firstMeal: old.slotTimes.breakfast,
          lastMeal: old.slotTimes.dinner,
        }
      : {}),
  };
  return {
    profile: {
      ...base,
      ...(old ?? {}),
      rhythm: { ...base.rhythm, ...rhythm },
      habits: { ...base.habits, ...(old?.habits ?? {}) },
      slotTimes: { ...base.slotTimes, ...(old?.slotTimes ?? {}) },
      facts: old?.facts ?? [],
      weeklyTarget: old?.weeklyTarget ?? base.weeklyTarget,
      why: old?.why ?? "",
      joinedAt: old?.joinedAt ?? ([...(raw.logs ?? [])].map((l) => l.date).sort()[0] || undefined),
    },
    stack: (raw.stack ?? []).map(normalizeItem),
    logs: raw.logs ?? [],
    body: raw.body ?? [],
    effects: raw.effects ?? [],
    days: raw.days ?? [],
    decisions: raw.decisions ?? [],
  };
}

function withBadges(state: PersistedData & { refilled?: boolean }): BadgeId[] {
  return earnedBadges({
    stack: state.stack,
    logs: state.logs,
    body: state.body,
    effects: state.effects,
    already: state.profile.badges,
    refilled: state.refilled,
  });
}

function applyDoseChange(item: StackItem, amount: number, unit: string, date: string): StackItem {
  const history = normalizeItem(item).doseHistory.filter((step) => step.date !== date);
  // Changing the dose on the day you started just corrects the starting dose.
  const steps =
    date <= item.startedAt
      ? [{ date: item.startedAt, amount, unit }]
      : [...history, { date, amount, unit }];
  return { ...item, amount, unit, doseHistory: steps };
}

function applyStartDate(item: StackItem, startedAt: string): StackItem {
  // The first dose step always begins on the start date; later steps that now fall
  // before it are folded into it.
  const steps = item.doseHistory;
  const later = steps.slice(1).filter((step) => step.date > startedAt);
  const first =
    steps
      .slice(1)
      .filter((step) => step.date <= startedAt)
      .pop() ?? steps[0]!;
  return { ...item, startedAt, doseHistory: [{ ...first, date: startedAt }, ...later] };
}

const empty = (): PersistedData => ({
  profile: defaultProfile(),
  stack: [],
  logs: [],
  body: [],
  effects: [],
  days: [],
  decisions: [],
});

export const useSupplime = create<SupplimeStore>()(
  persist(
    (set, get) => {
      const mapItem = (id: string, fn: (item: StackItem) => StackItem) =>
        set({ stack: get().stack.map((item) => (item.id === id ? fn(item) : item)) });

      return {
        ...empty(),
        hydrated: false,
        setHydrated: (value) => set({ hydrated: value }),

        completeOnboarding: ({ displayName, why, goals, rhythm, habits, items, notifications }) => {
          const profile: Profile = {
            ...defaultProfile(),
            displayName: displayName.trim() || "You",
            why: why.trim(),
            goals,
            rhythm,
            habits,
            slotTimes: slotTimesFromRhythm(rhythm),
            notifications,
            onboarded: true,
            joinedAt: appToday(),
          };
          set({ ...empty(), profile });
          const stack = items.map(newItem).filter((i): i is StackItem => !!i);
          set({ stack });
        },

        addItem: (input) => {
          if (input.catalogId) {
            const existing = get().stack.find(
              (i) => i.catalogId === input.catalogId && !i.archived,
            );
            if (existing) return existing.id;
          }
          const item = newItem(input);
          if (!item) return null;
          set({ stack: [...get().stack, item] });
          return item.id;
        },
        addFromCatalog: (catalogId) => get().addItem({ catalogId }),

        saveItem: (id, draft) => {
          const { amount, doseChange, startedAt, ...rest } = draft;
          mapItem(id, (item) => {
            let next = normalizeItem({ ...item, ...rest, id: item.id });
            if (startedAt && startedAt !== item.startedAt) next = applyStartDate(next, startedAt);
            if (rest.unit && rest.unit !== item.unit) {
              next = {
                ...next,
                doseHistory: next.doseHistory.map((s, i, all) =>
                  i === all.length - 1 ? { ...s, unit: rest.unit! } : s,
                ),
              };
            }
            if (amount !== undefined && amount > 0 && amount !== item.amount) {
              if (doseChange === "correction") {
                next = {
                  ...next,
                  amount,
                  doseHistory: next.doseHistory.map((s, i, all) =>
                    i === all.length - 1 ? { ...s, amount } : s,
                  ),
                };
              } else {
                next = applyDoseChange(next, amount, next.unit, appToday());
              }
            }
            return next;
          });
        },

        updateItem: (id, patch) => {
          mapItem(id, (item) => {
            const next = normalizeItem({ ...item, ...patch, id: item.id });
            return patch.startedAt ? applyStartDate(next, patch.startedAt) : next;
          });
        },

        changeDose: (id, amount, unit, date = appToday()) => {
          mapItem(id, (item) => applyDoseChange(item, amount, unit ?? item.unit, date));
        },

        archiveItem: (id, verdict, note) => {
          mapItem(id, (item) => ({ ...item, archived: { date: appToday(), verdict, note } }));
        },
        restoreItem: (id) => {
          mapItem(id, (item) => ({ ...item, archived: undefined, paused: false }));
        },
        removeItem: (id) => {
          const s = get();
          set({
            stack: s.stack.filter((item) => item.id !== id),
            logs: s.logs.filter((log) => log.itemId !== id),
            effects: s.effects.filter((e) => e.itemId !== id),
            decisions: s.decisions.filter((d) => d.itemId !== id),
          });
        },

        refill: (id, servings) => {
          const state = get();
          const stack = state.stack.map((item) =>
            item.id === id
              ? { ...item, servingsRemaining: servings ?? item.servingsPerContainer }
              : item,
          );
          set({
            stack,
            profile: { ...state.profile, badges: withBadges({ ...state, stack, refilled: true }) },
          });
        },

        logDose: (itemId, slot, status, date = appToday(), extra) => {
          const state = get();
          const existing = state.logs.find(
            (log) => log.itemId === itemId && log.slot === slot && log.date === date,
          );
          const wasTaken = existing?.status === "taken";
          const entry: DoseLog = {
            id: existing?.id ?? uid(),
            itemId,
            date,
            slot,
            status,
            at: new Date().toISOString(),
            late: extra?.late,
            reason: extra?.reason,
            remindAt: extra?.remindAt,
          };
          const logs = existing
            ? state.logs.map((l) => (l.id === existing.id ? entry : l))
            : [...state.logs, entry];
          let stack = state.stack;
          const delta =
            status === "taken" && !wasTaken ? -1 : status !== "taken" && wasTaken ? 1 : 0;
          if (delta) {
            stack = stack.map((item) =>
              item.id === itemId
                ? {
                    ...item,
                    servingsRemaining: Math.max(
                      0,
                      item.servingsRemaining + delta * item.servingsPerDose,
                    ),
                  }
                : item,
            );
          }
          set({
            logs,
            stack,
            profile: { ...state.profile, badges: withBadges({ ...state, stack, logs }) },
          });
        },

        deferDose: (itemId, slot, remindAt, reason, date = appToday()) => {
          get().logDose(itemId, slot, "deferred", date, { remindAt, reason });
        },

        undoDose: (itemId, slot, date = appToday()) => {
          const state = get();
          const existing = state.logs.find(
            (log) => log.itemId === itemId && log.slot === slot && log.date === date,
          );
          if (!existing) return;
          const logs = state.logs.filter((log) => log.id !== existing.id);
          const stack =
            existing.status === "taken"
              ? state.stack.map((item) =>
                  item.id === itemId
                    ? { ...item, servingsRemaining: item.servingsRemaining + item.servingsPerDose }
                    : item,
                )
              : state.stack;
          set({ logs, stack });
        },

        logEffect: (itemId, rating, opts) => {
          const state = get();
          const date = opts?.date ?? appToday();
          const prev = state.effects.find((e) => e.itemId === itemId && e.date === date);
          const effects = [
            ...state.effects.filter((e) => e !== prev),
            {
              id: prev?.id ?? uid(),
              itemId,
              date,
              rating,
              note: opts?.note?.trim() || prev?.note,
              sideEffects: opts?.sideEffects ?? prev?.sideEffects,
            },
          ];
          set({
            effects,
            profile: { ...state.profile, badges: withBadges({ ...state, effects }) },
          });
        },
        removeEffect: (id) => set({ effects: get().effects.filter((e) => e.id !== id) }),

        decide: (itemId, kind, opts) => {
          const state = get();
          const item = state.stack.find((i) => i.id === itemId);
          if (!item) return;
          const date = appToday();
          const decision: Decision = {
            id: uid(),
            itemId,
            date,
            kind,
            from: item.amount,
            to: opts?.to,
            note: opts?.note?.trim() || undefined,
          };
          set({ decisions: [...state.decisions, decision] });
          if ((kind === "step-up" || kind === "lower") && opts?.to)
            get().changeDose(itemId, opts.to);
          if (kind === "stop") get().archiveItem(itemId, opts?.verdict ?? "no-effect", opts?.note);
        },

        setDay: (date, patch) => {
          const days = get().days;
          const prev = days.find((d) => d.date === date) ?? { date };
          const next = { ...prev, ...patch, date };
          // Keep about two months of day notes.
          const keep = days.filter((d) => d.date !== date).slice(-60);
          set({ days: [...keep, next] });
        },

        revealFact: (factId, date = appToday()) => {
          const profile = get().profile;
          if (profile.facts.some((f) => f.endsWith(`|${factId}`))) return;
          set({ profile: { ...profile, facts: [...profile.facts, `${date}|${factId}`] } });
        },

        setRhythm: (rhythm) => {
          set({ profile: { ...get().profile, rhythm, slotTimes: slotTimesFromRhythm(rhythm) } });
        },
        setProfile: (patch) => set({ profile: { ...get().profile, ...patch } }),

        importData: (data) => {
          if (!data || typeof data !== "object") return false;
          const raw = (
            "state" in data ? (data as { state: unknown }).state : data
          ) as Partial<PersistedData>;
          if (!raw.profile || !Array.isArray(raw.stack)) return false;
          set(normalizeData(raw));
          return true;
        },

        logBody: (entry) => {
          const state = get();
          const body = [...state.body.filter((b) => b.date !== entry.date), entry].sort((a, b) =>
            a.date.localeCompare(b.date),
          );
          set({ body, profile: { ...state.profile, badges: withBadges({ ...state, body }) } });
        },
        importBody: (entries) => {
          const state = get();
          const map = new Map(state.body.map((b) => [b.date, b]));
          for (const entry of entries) map.set(entry.date, { ...map.get(entry.date), ...entry });
          const body = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
          set({ body, profile: { ...state.profile, badges: withBadges({ ...state, body }) } });
        },
        setNotifications: (value) => set({ profile: { ...get().profile, notifications: value } }),
        setSlotTime: (slot, time) => {
          const profile = get().profile;
          set({ profile: { ...profile, slotTimes: { ...profile.slotTimes, [slot]: time } } });
        },
        setCoach: (result) =>
          set({
            profile: { ...get().profile, lastCoach: result, lastCoachAt: new Date().toISOString() },
          }),
        resetAll: () => set(empty()),
      };
    },
    {
      name: "supplime-v1",
      version: 3,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted) => normalizeData((persisted ?? {}) as Partial<PersistedData>),
      merge: (persisted, current) => ({
        ...current,
        ...normalizeData((persisted ?? {}) as Partial<PersistedData>),
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
      partialize: (state): PersistedData => ({
        profile: state.profile,
        stack: state.stack,
        logs: state.logs,
        body: state.body,
        effects: state.effects,
        days: state.days,
        decisions: state.decisions,
      }),
    },
  ),
);

export function exportData(): PersistedData {
  const { profile, stack, logs, body, effects, days, decisions } = useSupplime.getState();
  // Never write the coach key into a backup file.
  return {
    profile: { ...profile, coachKey: undefined },
    stack,
    logs,
    body,
    effects,
    days,
    decisions,
  };
}
