import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { CATALOG_BY_ID } from "./catalog";
import { backfillLogs, type BackfillPattern } from "./advisor";
import { defaultRhythm, logicalDate, nowInDay, slotTimesFromRhythm } from "./protocol";
import { pillsFor, unitStrength } from "./knowledge";
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
  ItemProduct,
  MissReason,
  PendingDose,
  PersistedData,
  Profile,
  Rhythm,
  SlotId,
  StackItem,
  Verdict,
} from "./types";
import { addDays, formatHHMM, uid } from "./utils";

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
    reorderLeadDays: 14,
    coachProvider: "share",
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
  /** A real bottle: dose becomes pills × strength. */
  product?: ItemProduct;
  /** Pills per dose (with a product). */
  units?: number;
  /** Owned but not started yet. */
  planned?: boolean;
  /** Already taking it since `startedAt`: how consistently. */
  backfill?: BackfillPattern;
  /** Pills left in the current bottle, if not full. */
  remaining?: number;
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
    | "product"
    | "foodOk"
    | "reorderCustom"
  >
> & {
  amount?: number;
  /** new-step: you changed the dose from today. correction: the dose was entered wrong. */
  doseChange?: "new-step" | "correction";
  /** For a new step: the day it starts (tomorrow if today's dose was already taken). */
  startOn?: string;
};

/** Switching to a different-strength bottle as part of a dose change. */
export type SwapTo = { product: ItemProduct; units: number; bottle: number };

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
  startPlanned: (id: string) => void;
  logSafety: (itemId: string, symptoms: string[]) => void;
  setReorderLead: (days: number) => void;
  addCoachNote: (text: string, source: string) => void;
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
  /** Fix a past day: taken, skipped, or clear it. Adjusts pills left. */
  setDoseRecord: (
    itemId: string,
    slot: SlotId,
    date: string,
    status: "taken" | "skipped" | null,
    reason?: MissReason,
    away?: boolean,
  ) => void;
  /** Away from `from` to `to`: every planned dose of these items becomes "skipped, not with me". */
  markAway: (itemIds: string[], from: string, to: string) => number;
  logEffect: (
    itemId: string,
    rating: EffectRating,
    opts?: { note?: string; sideEffects?: boolean; date?: string; area?: string },
  ) => void;
  removeEffect: (id: string) => void;
  decide: (
    itemId: string,
    kind: DecisionKind,
    opts?: {
      to?: number;
      note?: string;
      verdict?: Verdict;
      swapTo?: SwapTo;
      /** When the new dose starts (default: tomorrow if today's dose is already taken). */
      startOn?: string;
    },
  ) => void;
  /** Start any dose changes whose day has come. */
  applyPendingDoses: (today?: string) => void;
  cancelPendingDose: (itemId: string) => void;
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
  const units = Math.max(1, input.units ?? 1);
  const amount = input.product
    ? Math.round(input.product.dosePerUnit * units * 1000) / 1000
    : (input.amount ?? def?.defaultAmount ?? 1);
  const unit = input.unit ?? def?.unit ?? "mg";
  const startedAt = input.startedAt ?? appToday();
  const count = input.servingsPerContainer ?? 60;
  const lead = useSupplime.getState().profile.reorderLeadDays ?? 14;
  return {
    id: uid(),
    catalogId: def?.id ?? null,
    name,
    amount,
    unit,
    foodTiming: input.foodTiming ?? def?.foodTiming ?? "any",
    slots: input.slots?.length ? input.slots : def ? [...def.preferredSlots] : ["breakfast"],
    notes: "",
    servingsRemaining: input.remaining ?? count,
    servingsPerContainer: count,
    servingsPerDose: input.product ? units : 1,
    reorderAtDays: lead,
    startedAt,
    paused: false,
    doseHistory: [{ date: startedAt, amount, unit }],
    overrides: input.overrides,
    source: input.source,
    servingLabel: input.servingLabel,
    product: input.product,
    planned: input.planned || undefined,
  };
}

/** Add an item plus its reconstructed history, if any. */
function addWithHistory(input: NewItem): { item: StackItem; logs: DoseLog[] } | null {
  const item = newItem(input);
  if (!item) return null;
  const today = appToday();
  const logs =
    input.backfill && !input.planned && item.startedAt < today
      ? backfillLogs(item, item.startedAt, today, input.backfill)
      : [];
  return { item, logs };
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
      reorderLeadDays: old?.reorderLeadDays ?? base.reorderLeadDays,
      coachProvider: old?.coachProvider ?? (old?.coachKey ? "xai" : "share"),
      why: old?.why ?? "",
      joinedAt: old?.joinedAt ?? ([...(raw.logs ?? [])].map((l) => l.date).sort()[0] || undefined),
    },
    stack: (raw.stack ?? []).map(normalizeItem),
    logs: raw.logs ?? [],
    body: raw.body ?? [],
    effects: raw.effects ?? [],
    days: raw.days ?? [],
    decisions: raw.decisions ?? [],
    checks: raw.checks ?? [],
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
    checks: state.checks,
    decisions: state.decisions,
    linked: !!state.profile.healthSync?.enabled,
  });
}

function applyDoseChange(item: StackItem, amount: number, unit: string, date: string): StackItem {
  // Several changes on one day are one change: the last one wins.
  const history = normalizeItem(item).doseHistory.filter((step) => step.date !== date);
  // Changing the dose on the day you started just corrects the starting dose.
  let steps =
    date <= item.startedAt
      ? [{ date: item.startedAt, amount, unit }]
      : [...history, { date, amount, unit }];
  // Back to where you were this morning: no change at all.
  const prev = steps.at(-2);
  if (prev && prev.amount === amount && prev.unit === unit) steps = steps.slice(0, -1);
  return { ...item, amount, unit, doseHistory: steps, servingsPerDose: pillCount(item, amount) };
}

/** A dose change starts tomorrow if you already took today's dose at the old one. */
export function defaultStart(logs: DoseLog[], itemId: string, today: string) {
  const takenToday = logs.some(
    (l) => l.itemId === itemId && l.date === today && l.status === "taken",
  );
  return takenToday ? addDays(today, 1) : today;
}

/** Put a dose change into effect on `date` (new step, new pill count, maybe a new bottle). */
function startDose(item: StackItem, p: PendingDose, date: string): StackItem {
  if (p.product) {
    const next = applyDoseChange(
      { ...item, product: p.product, servingLabel: undefined },
      p.amount,
      item.unit,
      date,
    );
    return {
      ...next,
      servingsPerDose: p.units,
      servingsRemaining: p.bottle ?? next.servingsRemaining,
      servingsPerContainer: p.bottle ?? next.servingsPerContainer,
    };
  }
  return { ...applyDoseChange(item, p.amount, item.unit, date), servingsPerDose: p.units };
}

/** Pills per dose for a new amount, when we know what one pill holds. */
function pillCount(item: StackItem, amount: number) {
  if (unitStrength(item).source === "none") return item.servingsPerDose ?? 1;
  return pillsFor(item, amount);
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
  checks: [],
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
            installedAt: appToday(),
          };
          set({ ...empty(), profile });
          const added = items.map(addWithHistory).filter((x): x is NonNullable<typeof x> => !!x);
          const logs = added.flatMap((a) => a.logs);
          const earliest = logs.map((l) => l.date).sort()[0];
          set({
            stack: added.map((a) => a.item),
            logs,
            profile:
              earliest && earliest < profile.joinedAt!
                ? { ...profile, joinedAt: earliest }
                : profile,
          });
          const state = get();
          set({ profile: { ...state.profile, badges: withBadges(state) } });
        },

        addItem: (input) => {
          if (input.catalogId) {
            const existing = get().stack.find(
              (i) => i.catalogId === input.catalogId && !i.archived,
            );
            if (existing) return existing.id;
          }
          const added = addWithHistory(input);
          if (!added) return null;
          const state = get();
          const earliest = added.logs[0]?.date;
          const joinedAt = state.profile.joinedAt;
          set({
            stack: [...state.stack, added.item],
            logs: [...state.logs, ...added.logs],
            profile:
              earliest && joinedAt && earliest < joinedAt
                ? { ...state.profile, joinedAt: earliest }
                : state.profile,
          });
          return added.item.id;
        },
        addFromCatalog: (catalogId) => get().addItem({ catalogId }),

        startPlanned: (id) => {
          const today = appToday();
          mapItem(id, (item) => ({
            ...item,
            planned: undefined,
            startedAt: today,
            doseHistory: [{ date: today, amount: item.amount, unit: item.unit }],
          }));
        },

        logSafety: (itemId, symptoms) => {
          const date = appToday();
          const checks = [
            ...get().checks.filter((c) => !(c.itemId === itemId && c.date === date)),
            { id: uid(), itemId, date, symptoms },
          ];
          set({ checks });
          const state = get();
          set({ profile: { ...state.profile, badges: withBadges(state) } });
        },

        setReorderLead: (days) => {
          const state = get();
          set({
            profile: { ...state.profile, reorderLeadDays: days },
            stack: state.stack.map((i) => (i.reorderCustom ? i : { ...i, reorderAtDays: days })),
          });
        },

        addCoachNote: (text, source) => {
          const profile = get().profile;
          const notes = [
            ...(profile.coachNotes ?? []),
            { date: appToday(), text: text.trim(), source },
          ].slice(-20);
          set({ profile: { ...profile, coachNotes: notes } });
        },

        saveItem: (id, draft) => {
          const { doseChange, startedAt, startOn, ...rest } = draft;
          let amount = draft.amount;
          mapItem(id, (item) => {
            const product = rest.product ?? item.product;
            // With a real bottle, the dose is pills: keep amount in step with them.
            if (product && rest.servingsPerDose && amount === undefined) {
              amount = Math.round(product.dosePerUnit * rest.servingsPerDose * 1000) / 1000;
            }
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
              const newAmount = amount;
              if (doseChange === "correction") {
                next = {
                  ...next,
                  amount: newAmount,
                  doseHistory: next.doseHistory.map((s, i, all) =>
                    i === all.length - 1 ? { ...s, amount: newAmount } : s,
                  ),
                };
              } else if (startOn && startOn > appToday()) {
                // Starts tomorrow: today stays at the old dose.
                next = {
                  ...next,
                  amount: item.amount,
                  servingsPerDose: item.servingsPerDose,
                  pendingDose: {
                    date: startOn,
                    kind: newAmount > item.amount ? "step-up" : "lower",
                    amount: newAmount,
                    units: rest.servingsPerDose ?? pillCount(item, newAmount),
                  },
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
          // Flexible mornings: a first log today means you're up by now, so reminders stop
          // waiting for "I'm up". Your watch or your own tap can correct it later.
          if (
            status === "taken" &&
            state.profile.rhythm.flexibleWake &&
            date === appToday() &&
            !state.days.find((d) => d.date === date)?.wokeAt
          ) {
            const now = nowInDay(new Date(), state.profile.rhythm);
            get().setDay(date, { wokeAt: formatHHMM(now % 1440), wakeSource: "inferred" });
          }
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

        setDoseRecord: (itemId, slot, date, status, reason, away) => {
          const state = get();
          const item = state.stack.find((i) => i.id === itemId);
          if (!item) return;
          const existing = state.logs.find(
            (l) => l.itemId === itemId && l.slot === slot && l.date === date,
          );
          const wasTaken = existing?.status === "taken";
          const isTaken = status === "taken";
          const others = state.logs.filter((l) => l !== existing);
          const logs: DoseLog[] = status
            ? [
                ...others,
                {
                  id: existing?.id ?? uid(),
                  itemId,
                  date,
                  slot,
                  status,
                  at: existing?.at ?? new Date().toISOString(),
                  reason: status === "skipped" ? (reason ?? existing?.reason ?? "forgot") : undefined,
                  late: isTaken ? existing?.late : undefined,
                  edited: date < appToday() ? true : existing?.edited,
                  away: status === "skipped" && away ? true : undefined,
                },
              ]
            : others;
          const delta = isTaken === wasTaken ? 0 : isTaken ? -1 : 1;
          const stack = delta
            ? state.stack.map((i) =>
                i.id === itemId
                  ? {
                      ...i,
                      servingsRemaining: Math.max(0, i.servingsRemaining + delta * i.servingsPerDose),
                    }
                  : i,
              )
            : state.stack;
          set({ logs, stack });
        },

        markAway: (itemIds, from, to) => {
          let n = 0;
          for (const id of itemIds) {
            const item = get().stack.find((i) => i.id === id);
            if (!item || item.planned) continue;
            for (let d = from; d <= to; d = addDays(d, 1)) {
              if (d < item.startedAt || (item.archived && d > item.archived.date)) continue;
              for (const slot of item.slots) {
                get().setDoseRecord(id, slot, d, "skipped", "not-with-me", true);
                n++;
              }
            }
          }
          return n;
        },

        logEffect: (itemId, rating, opts) => {
          const state = get();
          const date = opts?.date ?? appToday();
          const area = opts?.area;
          const prev = state.effects.find(
            (e) =>
              e.itemId === itemId &&
              e.date === date &&
              (area === undefined || (e.area ?? area) === area),
          );
          const effects = [
            ...state.effects.filter((e) => e !== prev),
            {
              id: prev?.id ?? uid(),
              itemId,
              date,
              rating,
              note: opts?.note?.trim() || prev?.note,
              sideEffects: opts?.sideEffects ?? prev?.sideEffects,
              area: area ?? prev?.area,
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
          // A second decision on the same day revises the first one (no extra XP, and the
          // dose you started the day on stays the "from").
          const sameDay = state.decisions.filter((d) => d.itemId === itemId && d.date === date);
          const decision: Decision = {
            id: sameDay[0]?.id ?? uid(),
            itemId,
            date,
            kind,
            from: sameDay[0]?.from ?? item.amount,
            to: opts?.to,
            note: opts?.note?.trim() || sameDay.find((d) => d.note)?.note,
          };
          set({
            decisions: [...state.decisions.filter((d) => !sameDay.includes(d)), decision],
          });
          if ((kind === "step-up" || kind === "lower") && (opts?.swapTo || opts?.to)) {
            const startOn = opts.startOn ?? defaultStart(state.logs, itemId, date);
            const units = opts.swapTo?.units ?? pillsFor(item, opts.to!);
            const amount = opts.swapTo
              ? Math.round(opts.swapTo.units * opts.swapTo.product.dosePerUnit * 1000) / 1000
              : opts.to!;
            const pending: PendingDose = {
              date: startOn,
              kind,
              amount,
              units,
              product: opts.swapTo?.product,
              bottle: opts.swapTo?.bottle,
            };
            if (startOn > date) mapItem(itemId, (i) => ({ ...i, pendingDose: pending }));
            else mapItem(itemId, (i) => startDose({ ...i, pendingDose: undefined }, pending, date));
          }
          if (kind === "stop") get().archiveItem(itemId, opts?.verdict ?? "no-effect", opts?.note);
        },

        applyPendingDoses: (today = appToday()) => {
          const due = get().stack.filter((i) => i.pendingDose && i.pendingDose.date <= today);
          if (!due.length) return;
          set({
            stack: get().stack.map((i) =>
              i.pendingDose && i.pendingDose.date <= today
                ? startDose({ ...i, pendingDose: undefined }, i.pendingDose, i.pendingDose.date)
                : i,
            ),
          });
        },
        cancelPendingDose: (itemId) => {
          const state = get();
          const today = appToday();
          set({
            stack: state.stack.map((i) => (i.id === itemId ? { ...i, pendingDose: undefined } : i)),
            // The decision that scheduled it goes too.
            decisions: state.decisions.filter(
              (d) => !(d.itemId === itemId && d.date === today && (d.kind === "step-up" || d.kind === "lower")),
            ),
          });
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
      version: 4,
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
        checks: state.checks,
      }),
    },
  ),
);

export function exportData(): PersistedData {
  const { profile, stack, logs, body, effects, days, decisions, checks } = useSupplime.getState();
  // Never write API keys into a backup file.
  return {
    profile: { ...profile, coachKey: undefined, geminiKey: undefined },
    stack,
    logs,
    body,
    effects,
    days,
    decisions,
    checks,
  };
}
