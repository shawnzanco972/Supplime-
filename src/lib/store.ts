import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { CATALOG_BY_ID } from "./catalog";
import { defaultSlotTimes } from "./protocol";
import { earnedBadges } from "./stats";
import type {
  BadgeId,
  BodyLog,
  CoachResult,
  DoseLog,
  DoseStatus,
  EffectLog,
  EffectRating,
  FoodTiming,
  GoalId,
  PersistedData,
  Profile,
  SlotId,
  StackItem,
} from "./types";
import { todayKey, uid } from "./utils";

const defaultProfile = (): Profile => ({
  displayName: "",
  goals: [],
  onboarded: false,
  notifications: false,
  reminderLeadMinutes: 10,
  slotTimes: defaultSlotTimes(),
  badges: [],
  lastCoach: null,
  nagMinutes: 30,
});

type SupplimeStore = {
  profile: Profile;
  stack: StackItem[];
  logs: DoseLog[];
  body: BodyLog[];
  effects: EffectLog[];
  hydrated: boolean;
  setHydrated: (value: boolean) => void;
  completeOnboarding: (input: {
    displayName: string;
    goals: GoalId[];
    catalogIds: string[];
    notifications: boolean;
  }) => void;
  addFromCatalog: (catalogId: string) => string | null;
  addCustom: (input: {
    name: string;
    amount: number;
    unit: string;
    foodTiming: FoodTiming;
    slots: SlotId[];
  }) => string;
  updateItem: (id: string, patch: Partial<StackItem>) => void;
  /** Move to a new dose level, starting today (or the given date). */
  changeDose: (id: string, amount: number, unit?: string, date?: string) => void;
  logEffect: (itemId: string, rating: EffectRating, note?: string, date?: string) => void;
  removeEffect: (id: string) => void;
  setProfile: (patch: Partial<Profile>) => void;
  importData: (data: unknown) => boolean;
  removeItem: (id: string) => void;
  refill: (id: string, servings?: number) => void;
  logDose: (itemId: string, slot: SlotId, status: DoseStatus, date?: string) => void;
  undoDose: (itemId: string, slot: SlotId, date?: string) => void;
  logBody: (entry: BodyLog) => void;
  importBody: (entries: BodyLog[]) => void;
  setNotifications: (value: boolean) => void;
  setSlotTime: (slot: SlotId, time: string) => void;
  setCoach: (result: CoachResult) => void;
  resetAll: () => void;
};

function itemFromCatalog(catalogId: string): StackItem | null {
  const def = CATALOG_BY_ID[catalogId];
  if (!def) return null;
  return {
    id: uid(),
    catalogId: def.id,
    name: def.name,
    amount: def.defaultAmount,
    unit: def.unit,
    foodTiming: def.foodTiming,
    slots: [...def.preferredSlots],
    notes: "",
    servingsRemaining: 60,
    servingsPerContainer: 60,
    servingsPerDose: 1,
    reorderAtDays: 10,
    startedAt: todayKey(),
    paused: false,
    doseHistory: [{ date: todayKey(), amount: def.defaultAmount, unit: def.unit }],
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
  return {
    profile: {
      ...base,
      ...(raw.profile ?? {}),
      slotTimes: { ...base.slotTimes, ...(raw.profile?.slotTimes ?? {}) },
    },
    stack: (raw.stack ?? []).map(normalizeItem),
    logs: raw.logs ?? [],
    body: raw.body ?? [],
    effects: raw.effects ?? [],
  };
}

function withBadges(state: {
  profile: Profile;
  stack: StackItem[];
  logs: DoseLog[];
  body: BodyLog[];
  effects: EffectLog[];
  refilled?: boolean;
}): BadgeId[] {
  return earnedBadges({
    stack: state.stack,
    logs: state.logs,
    body: state.body,
    effects: state.effects,
    already: state.profile.badges,
    refilled: state.refilled,
  });
}

export const useSupplime = create<SupplimeStore>()(
  persist(
    (set, get) => ({
      profile: defaultProfile(),
      stack: [],
      logs: [],
      body: [],
      effects: [],
      hydrated: false,
      setHydrated: (value) => set({ hydrated: value }),
      completeOnboarding: ({ displayName, goals, catalogIds, notifications }) => {
        const stack: StackItem[] = [];
        for (const id of catalogIds) {
          const item = itemFromCatalog(id);
          if (item) stack.push(item);
        }
        set({
          profile: {
            ...defaultProfile(),
            displayName: displayName.trim() || "You",
            goals,
            notifications,
            onboarded: true,
          },
          stack,
          logs: [],
          body: [],
          effects: [],
        });
      },
      addFromCatalog: (catalogId) => {
        const existing = get().stack.find((item) => item.catalogId === catalogId);
        if (existing) return existing.id;
        const item = itemFromCatalog(catalogId);
        if (!item) return null;
        set({ stack: [...get().stack, item] });
        return item.id;
      },
      addCustom: (input) => {
        const item: StackItem = {
          id: uid(),
          catalogId: null,
          name: input.name.trim(),
          amount: input.amount,
          unit: input.unit,
          foodTiming: input.foodTiming,
          slots: input.slots,
          notes: "",
          servingsRemaining: 30,
          servingsPerContainer: 30,
          servingsPerDose: 1,
          reorderAtDays: 10,
          startedAt: todayKey(),
          paused: false,
          doseHistory: [{ date: todayKey(), amount: input.amount, unit: input.unit }],
        };
        set({ stack: [...get().stack, item] });
        return item.id;
      },
      updateItem: (id, patch) => {
        set({
          stack: get().stack.map((item) => {
            if (item.id !== id) return item;
            const next = normalizeItem({ ...item, ...patch, id: item.id });
            if (patch.startedAt) {
              // The first dose step always begins on the start date; later steps
              // that now fall before it are folded into it.
              const later = next.doseHistory.slice(1).filter((step) => step.date > next.startedAt);
              const first =
                next.doseHistory
                  .slice(1)
                  .filter((step) => step.date <= next.startedAt)
                  .pop() ?? next.doseHistory[0];
              next.doseHistory = [{ ...first, date: next.startedAt }, ...later];
            }
            return next;
          }),
        });
      },
      changeDose: (id, amount, unit, date = todayKey()) => {
        set({
          stack: get().stack.map((item) => {
            if (item.id !== id) return item;
            const nextUnit = unit ?? item.unit;
            const history = normalizeItem(item).doseHistory.filter((step) => step.date !== date);
            // Changing the dose on the day you started just corrects the starting dose.
            const steps =
              date <= item.startedAt
                ? [{ date: item.startedAt, amount, unit: nextUnit }]
                : [...history, { date, amount, unit: nextUnit }];
            return { ...item, amount, unit: nextUnit, doseHistory: steps };
          }),
        });
      },
      logEffect: (itemId, rating, note, date = todayKey()) => {
        const state = get();
        const effects = [
          ...state.effects.filter((e) => !(e.itemId === itemId && e.date === date)),
          { id: uid(), itemId, date, rating, note: note?.trim() || undefined },
        ];
        const profile = { ...state.profile, badges: withBadges({ ...state, effects }) };
        set({ effects, profile });
      },
      removeEffect: (id) => {
        set({ effects: get().effects.filter((e) => e.id !== id) });
      },
      setProfile: (patch) => {
        set({ profile: { ...get().profile, ...patch } });
      },
      importData: (data) => {
        if (!data || typeof data !== "object") return false;
        const raw = (
          "state" in data ? (data as { state: unknown }).state : data
        ) as Partial<PersistedData>;
        if (!raw.profile || !Array.isArray(raw.stack)) return false;
        set(normalizeData(raw));
        return true;
      },
      removeItem: (id) => {
        set({
          stack: get().stack.filter((item) => item.id !== id),
          logs: get().logs.filter((log) => log.itemId !== id),
          effects: get().effects.filter((e) => e.itemId !== id),
        });
      },
      refill: (id, servings) => {
        const state = get();
        const stack = state.stack.map((item) =>
          item.id === id
            ? {
                ...item,
                servingsRemaining: servings ?? item.servingsPerContainer,
              }
            : item,
        );
        const profile = {
          ...state.profile,
          badges: withBadges({ ...state, stack, refilled: true }),
        };
        set({ stack, profile });
      },
      logDose: (itemId, slot, status, date = todayKey()) => {
        const state = get();
        const existing = state.logs.find(
          (log) => log.itemId === itemId && log.slot === slot && log.date === date,
        );
        let logs: DoseLog[];
        if (existing) {
          logs = state.logs.map((log) =>
            log.id === existing.id ? { ...log, status, at: new Date().toISOString() } : log,
          );
        } else {
          logs = [
            ...state.logs,
            {
              id: uid(),
              itemId,
              date,
              slot,
              status,
              at: new Date().toISOString(),
            },
          ];
        }
        let stack = state.stack;
        const wasTaken = existing?.status === "taken";
        if (status === "taken" && !wasTaken) {
          stack = stack.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  servingsRemaining: Math.max(0, item.servingsRemaining - item.servingsPerDose),
                }
              : item,
          );
        }
        if (status !== "taken" && wasTaken) {
          stack = stack.map((item) =>
            item.id === itemId
              ? { ...item, servingsRemaining: item.servingsRemaining + item.servingsPerDose }
              : item,
          );
        }
        const profile = { ...state.profile, badges: withBadges({ ...state, stack, logs }) };
        set({ logs, stack, profile });
      },
      undoDose: (itemId, slot, date = todayKey()) => {
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
      logBody: (entry) => {
        const state = get();
        const body = [...state.body.filter((b) => b.date !== entry.date), entry].sort((a, b) =>
          a.date.localeCompare(b.date),
        );
        const profile = { ...state.profile, badges: withBadges({ ...state, body }) };
        set({ body, profile });
      },
      importBody: (entries) => {
        const state = get();
        const map = new Map(state.body.map((b) => [b.date, b]));
        for (const entry of entries) {
          const prev = map.get(entry.date);
          map.set(entry.date, { ...prev, ...entry });
        }
        const body = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
        const profile = { ...state.profile, badges: withBadges({ ...state, body }) };
        set({ body, profile });
      },
      setNotifications: (value) => {
        set({ profile: { ...get().profile, notifications: value } });
      },
      setSlotTime: (slot, time) => {
        const profile = get().profile;
        set({ profile: { ...profile, slotTimes: { ...profile.slotTimes, [slot]: time } } });
      },
      setCoach: (result) => {
        set({
          profile: {
            ...get().profile,
            lastCoach: result,
            lastCoachAt: new Date().toISOString(),
          },
        });
      },
      resetAll: () => {
        set({ profile: defaultProfile(), stack: [], logs: [], body: [], effects: [] });
      },
    }),
    {
      name: "supplime-v1",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      migrate: (persisted) => normalizeData((persisted ?? {}) as Partial<PersistedData>),
      merge: (persisted, current) => ({
        ...current,
        ...normalizeData((persisted ?? {}) as Partial<PersistedData>),
      }),
      onRehydrateStorage: () => (state) => state?.setHydrated(true),
      partialize: (state) => ({
        profile: state.profile,
        stack: state.stack,
        logs: state.logs,
        body: state.body,
        effects: state.effects,
      }),
    },
  ),
);

export function exportData(): PersistedData {
  const { profile, stack, logs, body, effects } = useSupplime.getState();
  // Never write the coach key into a backup file.
  return { profile: { ...profile, coachKey: undefined }, stack, logs, body, effects };
}
