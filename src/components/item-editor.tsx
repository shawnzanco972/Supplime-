import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Field,
  FoodPicker,
  MissedPicker,
  NumberInput,
  RulesEditor,
  Section,
  SlotPicker,
  StartedPicker,
  TimelineFields,
  type TimelineValue,
  Chip,
  FoodOkPicker,
  ReorderLeadPicker,
  SlotHintPicker,
  Stepper,
} from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Confirm, Screen, Sheet } from "@/components/ui/screen";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { KNOWLEDGE, pillsFor, profileFor, unitStrength } from "@/lib/knowledge";
import { fitCheck } from "@/lib/advisor";
import { contentsLabel, productsFor, unitWord } from "@/lib/products";
import { useNav } from "@/lib/nav";
import { EFFECT_COPY, daysOfStock, effectHistory } from "@/lib/stats";
import { appToday, useSupplime, type ItemDraft } from "@/lib/store";
import type {
  FoodTiming,
  HabitRule,
  ItemOverrides,
  MissedMode,
  StackItem,
  Verdict,
} from "@/lib/types";
import { addDays, cn, daysBetween, formatShortDate } from "@/lib/utils";

export const VERDICT_COPY: Record<Verdict, string> = {
  worked: "It worked",
  "no-effect": "No effect",
  "side-effects": "Side effects",
  other: "Other reason",
};

/** Edit everything about one supplement. Nothing is saved until you tap Save. */
export function ItemEditor({ itemId }: { itemId: string }) {
  const close = useNav((s) => s.close);
  const item = useSupplime((s) => s.stack.find((i) => i.id === itemId));
  if (!item) return null;
  return <Editor key={item.id} item={item} onClose={close} />;
}

function Editor({ item, onClose }: { item: StackItem; onClose: () => void }) {
  const profile = useSupplime((s) => s.profile);
  const openOverlay = useNav((s) => s.open);
  const effects = useSupplime((s) => s.effects);
  const logs = useSupplime((s) => s.logs);
  const saveItem = useSupplime((s) => s.saveItem);
  const removeItem = useSupplime((s) => s.removeItem);
  const archiveItem = useSupplime((s) => s.archiveItem);
  const restoreItem = useSupplime((s) => s.restoreItem);
  const refill = useSupplime((s) => s.refill);
  const startPlanned = useSupplime((s) => s.startPlanned);
  const setStage = useSupplime((s) => s.setStage);
  const allStack = useSupplime((s) => s.stack);
  const removeEffect = useSupplime((s) => s.removeEffect);
  const today = appToday();
  const p = profileFor(item);
  // Guide values without your overrides, to know what to store.
  const guide = profileFor({ ...item, overrides: undefined });

  const [d, setD] = useState({
    name: item.name,
    amount: item.amount as number | undefined,
    unit: item.unit,
    doseChange: (item.startedAt < today ? "new-step" : "correction") as "new-step" | "correction",
    startedAt: item.startedAt,
    slots: item.slots,
    foodTiming: item.foodTiming,
    servingsRemaining: item.servingsRemaining as number | undefined,
    servingsPerContainer: item.servingsPerContainer as number | undefined,
    servingsPerDose: item.servingsPerDose as number | undefined,
    reorderAtDays: item.reorderAtDays as number | undefined,
    servingLabel: item.servingLabel ?? "",
    notes: item.notes,
    paused: item.paused,
    timeline: {
      firstSignsDay: p.firstSignsDay,
      typicalDay: p.typicalDay,
      minDaysBeforeIncrease: p.minDaysBeforeIncrease,
      evaluateDay: p.evaluateDay,
    } as TimelineValue,
    rules: p.rules as HabitRule[],
    missed: p.missed as MissedMode,
    foodOk: (item.foodOk ?? p.timing.food) as FoodTiming[],
    reorderCustom: !!item.reorderCustom,
    product: item.product,
    startTomorrow: null as boolean | null,
  });
  const set = (patch: Partial<typeof d>) => setD((prev) => ({ ...prev, ...patch }));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [slotMode, setSlotMode] = useState<"per-dose" | "daily" | null>(null);
  const [stopOpen, setStopOpen] = useState(false);

  const doseChanged = d.amount !== undefined && d.amount > 0 && d.amount !== item.amount;
  // Changing how many times a day: keep the amount per dose, or the daily total?
  const slotsChanged =
    d.slots.length > 0 && d.slots.length !== item.slots.length && !doseChangedByHand();
  const strength = unitStrength(item).amount;
  const totalPills = pillsFor(item) * item.slots.length;
  const dailyPills =
    d.slots.length > 0 &&
    totalPills % d.slots.length === 0 &&
    totalPills / d.slots.length !== pillsFor(item)
      ? totalPills / d.slots.length
      : null;
  const dailyAmount = dailyPills !== null ? Math.round(dailyPills * strength * 1000) / 1000 : null;
  const defaultSlotMode: "per-dose" | "daily" =
    p.kind === "acute" || dailyPills === null ? "per-dose" : "daily";
  const useDaily = slotsChanged && dailyPills !== null && (slotMode ?? defaultSlotMode) === "daily";
  const perDoseLabel = (amount: number) => {
    const n = Math.max(1, Math.round(amount / strength));
    return `${round2(amount)} ${item.unit} (${n} ${prod ? unitWord(prod.form, n) : n === 1 ? "pill" : "pills"})`;
  };
  function doseChangedByHand() {
    return d.amount !== undefined && d.amount !== item.amount;
  }
  const takenToday = logs.some(
    (l) => l.itemId === item.id && l.date === today && l.status === "taken",
  );
  const startTomorrow = d.startTomorrow ?? takenToday;
  const changedToday = item.doseHistory.length > 1 && item.doseHistory.at(-1)?.date === today;
  const prod = d.product;
  const pills = prod ? Math.max(1, Math.round((d.amount ?? item.amount) / prod.dosePerUnit)) : 1;
  const choices = item.catalogId ? productsFor(item.catalogId) : [];

  const draft = useMemo((): ItemDraft => {
    const overrides: ItemOverrides = {};
    if (d.timeline.firstSignsDay !== guide.firstSignsDay)
      overrides.firstSignsDay = d.timeline.firstSignsDay;
    if (d.timeline.typicalDay !== guide.typicalDay) overrides.typicalDay = d.timeline.typicalDay;
    if (d.timeline.minDaysBeforeIncrease !== guide.minDaysBeforeIncrease)
      overrides.minDaysBeforeIncrease = d.timeline.minDaysBeforeIncrease;
    if (d.timeline.evaluateDay !== guide.evaluateDay)
      overrides.evaluateDay = d.timeline.evaluateDay;
    if (JSON.stringify(d.rules) !== JSON.stringify(guide.rules)) overrides.rules = d.rules;
    if (d.missed !== guide.missed) overrides.missed = d.missed;
    return {
      name: d.name.trim() || item.name,
      unit: d.unit.trim() || item.unit,
      amount: useDaily ? dailyAmount! : d.amount,
      // Same daily total spread differently: fix the record, don't restart the clock.
      doseChange: useDaily ? "correction" : d.doseChange,
      startOn:
        !useDaily && d.doseChange === "new-step" && startTomorrow && !changedToday
          ? addDays(today, 1)
          : undefined,
      startedAt: d.startedAt,
      slots: d.slots,
      foodTiming: d.foodTiming,
      servingsRemaining: d.servingsRemaining ?? item.servingsRemaining,
      servingsPerContainer: d.servingsPerContainer ?? item.servingsPerContainer,
      servingsPerDose: useDaily
        ? dailyPills!
        : Math.max(1, d.servingsPerDose ?? item.servingsPerDose),
      reorderAtDays: d.reorderAtDays ?? item.reorderAtDays,
      servingLabel: item.product ? item.servingLabel : d.servingLabel.trim() || undefined,
      notes: d.notes,
      foodOk: JSON.stringify(d.foodOk) === JSON.stringify(p.timing.food) ? undefined : d.foodOk,
      reorderCustom: d.reorderCustom || undefined,
      paused: d.paused,
      product: d.product,
      overrides: Object.keys(overrides).length ? overrides : undefined,
    };
  }, [d, guide, item, useDaily, dailyAmount, dailyPills, startTomorrow, changedToday, today]);

  const dirty = useMemo(() => {
    const before: ItemDraft = {
      name: item.name,
      unit: item.unit,
      amount: item.amount,
      startedAt: item.startedAt,
      slots: item.slots,
      foodTiming: item.foodTiming,
      servingsRemaining: item.servingsRemaining,
      servingsPerContainer: item.servingsPerContainer,
      servingsPerDose: item.servingsPerDose,
      reorderAtDays: item.reorderAtDays,
      servingLabel: item.servingLabel,
      notes: item.notes,
      paused: item.paused,
      product: item.product,
      foodOk: item.foodOk,
      reorderCustom: item.reorderCustom || undefined,
      overrides: item.overrides && Object.keys(item.overrides).length ? item.overrides : undefined,
    };
    const { doseChange: _ignored, startOn: _start, ...now } = draft;
    return JSON.stringify(sortKeys(before)) !== JSON.stringify(sortKeys(now));
  }, [draft, item]);

  function save() {
    saveItem(item.id, draft);
    toast(`Saved ${draft.name}`, {
      description:
        doseChanged && d.doseChange === "new-step"
          ? draft.startOn
            ? `${d.amount} ${draft.unit} from tomorrow. Today stays as it was.`
            : `${d.amount} ${draft.unit} from today. The dose clock restarts.`
          : undefined,
    });
    onClose();
  }

  const history = effectHistory(item, effects).slice(-8).reverse();
  const isCustom = !item.catalogId;

  return (
    <Screen
      onClose={onClose}
      title={item.name}
      subtitle={
        item.archived
          ? `Stopped ${formatShortDate(item.archived.date)}`
          : `Day ${daysBetween(item.startedAt, today) + 1}`
      }
      footer={
        <>
          <Button variant="ghost" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button className="flex-[2]" disabled={!dirty} onClick={save}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {p.catalog && <p className="text-sm text-muted-foreground">{p.catalog.summary}</p>}
        {item.planned && (
          <div className="space-y-3 rounded-2xl bg-accent p-4 text-accent-foreground">
            <p className="font-medium">
              {item.stage === "interested"
                ? "You're interested, not ordered yet"
                : item.stage === "ordered"
                  ? "Ordered, on its way"
                  : "In your cabinet, not started yet"}
            </p>
            {item.stage === "ordered" && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm">Arrives around</span>
                <Input
                  type="date"
                  className="w-40"
                  value={item.arrivesOn ?? today}
                  onChange={(e) => e.target.value && setStage(item.id, "ordered", e.target.value)}
                />
              </div>
            )}
            {item.catalogId &&
              fitCheck(item.catalogId, {
                stack: allStack,
                today,
                arrivesOn: item.arrivesOn,
                excludeId: item.id,
              }).map((n) => (
                <p key={n.text} className={cn("text-sm", n.tone === "warn" && "text-warn")}>
                  {n.tone === "good" ? "✓ " : n.tone === "warn" ? "! " : "· "}
                  {n.text}
                </p>
              ))}
            <div className="flex flex-wrap gap-2">
              {item.stage === "interested" && (
                <Button
                  onClick={() => {
                    setStage(item.id, "ordered", addDays(today, 7));
                    toast(`${item.name}: on the way`);
                  }}
                >
                  I ordered it
                </Button>
              )}
              {item.stage === "ordered" && (
                <Button
                  onClick={() => {
                    setStage(item.id, null);
                    toast(`${item.name} is in your cabinet`);
                  }}
                >
                  It arrived
                </Button>
              )}
              {!item.stage && (
                <Button
                  onClick={() => {
                    startPlanned(item.id);
                    toast(`${item.name}: day 1`, {
                      description: "One new thing at a time — nice.",
                    });
                    onClose();
                  }}
                >
                  Start it today
                </Button>
              )}
            </div>
          </div>
        )}

        <Section title="Dose">
          {isCustom && (
            <Field label="Name" htmlFor="name">
              <Input id="name" value={d.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
          )}
          {!prod && choices.length > 0 && (
            <div className="space-y-2 rounded-xl bg-secondary p-3">
              <p className="text-sm font-medium">Pick your exact bottle</p>
              <p className="text-xs text-muted-foreground">
                Fills in the strength and ingredients, and counts pills for you.
              </p>
              <div className="grid gap-2">
                {choices.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      const units = Math.max(1, Math.round(item.amount / c.dosePerUnit));
                      set({
                        product: {
                          id: c.id,
                          brand: c.brand,
                          name: c.name,
                          form: c.form,
                          perUnit: c.perUnit,
                          dosePerUnit: c.dosePerUnit,
                          labelServing: c.labelServing,
                          labelUse: c.labelUse,
                        },
                        amount: Math.round(units * c.dosePerUnit * 1000) / 1000,
                        servingsPerDose: units,
                        servingsPerContainer: c.counts[0],
                        // Linking your bottle only fixes the record.
                        doseChange: "correction",
                      });
                    }}
                    className="rounded-xl bg-card px-3 py-2 text-left"
                  >
                    <span className="block text-sm font-medium">
                      {c.brand} · {c.name}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {contentsLabel(c.perUnit, 1, c.form)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {prod ? (
            <>
              <div>
                <p className="text-xs text-muted-foreground">{prod.brand}</p>
                <p className="text-sm font-medium">{prod.name}</p>
              </div>
              <Stepper
                value={pills}
                onChange={(n) =>
                  set({
                    amount: Math.round(n * prod!.dosePerUnit * 1000) / 1000,
                    servingsPerDose: n,
                    doseChange: "new-step",
                  })
                }
                label={`${unitWord(prod.form, pills)} per dose`}
              />
              <p className="rounded-xl bg-secondary px-3 py-2 text-sm">
                {contentsLabel(prod.perUnit, pills, prod.form)}
              </p>
              {prod.labelUse && (
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">On the label:</span> {prod.labelUse}
                </p>
              )}
            </>
          ) : (
            <div className="grid grid-cols-[1fr_7rem] gap-3">
              <Field label="Amount per dose" htmlFor="amount">
                <NumberInput id="amount" value={d.amount} onChange={(amount) => set({ amount })} />
              </Field>
              <Field label="Unit" htmlFor="unit">
                <Input id="unit" value={d.unit} onChange={(e) => set({ unit: e.target.value })} />
              </Field>
            </div>
          )}
          {doseChanged && item.startedAt < today && !changedToday && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Is this a real change?</p>
              <RadioCard
                on={d.doseChange === "new-step" && !startTomorrow}
                onClick={() => set({ doseChange: "new-step", startTomorrow: false })}
                title="Yes, starting today"
                detail={
                  takenToday
                    ? "Today's dose is already logged at the old amount, so today would be counted at the new one."
                    : `Starts a new step on your timeline. Supplime waits ${p.minDaysBeforeIncrease} days before suggesting another change.`
                }
              />
              <RadioCard
                on={d.doseChange === "new-step" && startTomorrow}
                onClick={() => set({ doseChange: "new-step", startTomorrow: true })}
                title="Yes, starting tomorrow"
                detail="Today stays at the old dose. Tomorrow is your dose-up day."
              />
              <RadioCard
                on={d.doseChange === "correction"}
                onClick={() => set({ doseChange: "correction" })}
                title="No, I entered it wrong before"
                detail="Fixes the record: your timeline stays as it is."
              />
            </div>
          )}
          {doseChanged && changedToday && (
            <p className="rounded-xl bg-secondary px-3 py-2 text-xs text-muted-foreground">
              You already changed this dose today, so this just updates today's change.
            </p>
          )}
          {!item.product && (
            <Field label="Strength per capsule (optional)" hint='For example "1 capsule = 500 mg".'>
              <Input
                value={d.servingLabel}
                onChange={(e) => set({ servingLabel: e.target.value })}
                placeholder="1 capsule = 500 mg"
              />
            </Field>
          )}
          {item.doseHistory.length > 1 && (
            <div className="border-t border-border pt-3">
              <p className="mb-1.5 text-xs font-medium">Dose history</p>
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {[...item.doseHistory].reverse().map((step, i) => (
                  <Fragment key={`${step.date}-${i}`}>
                    <dt className={cn(i === 0 && "font-medium text-foreground")}>
                      {i === 0 ? "Now" : "Before"}: {step.amount} {step.unit}
                    </dt>
                    <dd className="text-right tabular-nums">from {formatShortDate(step.date)}</dd>
                  </Fragment>
                ))}
              </dl>
            </div>
          )}
        </Section>

        <Section
          title="Started"
          hint="Set this right for things you were already taking, so the timeline is honest."
        >
          <StartedPicker
            value={d.startedAt}
            onChange={(startedAt) => set({ startedAt })}
            today={today}
          />
        </Section>

        <Section title="When">
          <SlotHintPicker
            value={d.slots}
            onChange={(slots) => {
              set({ slots });
              setSlotMode(null);
            }}
            times={profile.slotTimes}
            best={p.timing.best}
            avoid={p.timing.avoid}
          />
          {slotsChanged && (
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {d.slots.length < item.slots.length ? "Fewer times a day" : "More times a day"}:
                what about the amount?
              </p>
              <p className="text-xs text-muted-foreground">
                {p.kind === "acute"
                  ? `${item.name} works for a few hours after each dose, so the amount per dose matters most. Usually you just ${d.slots.length < item.slots.length ? "drop that dose" : "add a dose"}.`
                  : `${item.name} builds up over weeks, so the daily total matters most. Taking it all at once is fine.`}
              </p>
              <RadioCard
                on={(slotMode ?? defaultSlotMode) === "per-dose"}
                onClick={() => setSlotMode("per-dose")}
                title={`Same per dose: ${perDoseLabel(item.amount)} each time`}
                detail={`${round2(item.amount * d.slots.length)} ${item.unit} a day (was ${round2(item.amount * item.slots.length)}).`}
              />
              {dailyPills !== null && (
                <RadioCard
                  on={(slotMode ?? defaultSlotMode) === "daily"}
                  onClick={() => setSlotMode("daily")}
                  title={`Same daily total: ${perDoseLabel(dailyAmount!)} each time`}
                  detail={`Still ${round2(item.amount * item.slots.length)} ${item.unit} a day.`}
                />
              )}
            </div>
          )}
          <Field label="Food — every option that's fine">
            <FoodOkPicker
              value={d.foodOk}
              onChange={(foodOk) =>
                set({
                  foodOk,
                  foodTiming:
                    foodOk.includes("with") && !foodOk.includes("empty")
                      ? "with"
                      : foodOk.includes("empty") && !foodOk.includes("with")
                        ? "empty"
                        : "any",
                })
              }
              allowed={item.catalogId ? p.timing.food : undefined}
            />
          </Field>
          {p.catalog && <p className="text-xs text-muted-foreground">{p.catalog.foodWhy}</p>}
        </Section>

        <Section
          title="How long it takes"
          hint={
            isCustom
              ? "Your numbers drive the journey and verdict day."
              : "From the guide. Change them if you know better."
          }
        >
          <TimelineFields value={d.timeline} onChange={(timeline) => set({ timeline })} />
          {!isCustom && JSON.stringify(d.timeline) !== JSON.stringify(pickTimeline(guide)) && (
            <button
              type="button"
              className="text-xs underline"
              onClick={() => set({ timeline: pickTimeline(guide) })}
            >
              Reset to guide values
            </button>
          )}
        </Section>

        <Section
          title="Habits & rules"
          hint="Supplime flags conflicts with your coffee, drinks and meals."
        >
          <RulesEditor value={d.rules} onChange={(rules) => set({ rules })} />
          <Field label="If you miss a dose">
            <MissedPicker value={d.missed} onChange={(missed) => set({ missed })} />
          </Field>
          {item.catalogId &&
            KNOWLEDGE[item.catalogId] &&
            JSON.stringify(d.rules) !== JSON.stringify(guide.rules) && (
              <button
                type="button"
                className="text-xs underline"
                onClick={() => set({ rules: guide.rules, missed: guide.missed })}
              >
                Reset to guide rules
              </button>
            )}
        </Section>

        <Section title="Supply" hint={`About ${daysOfStock(item)} days left at your current pace.`}>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Left">
              <NumberInput
                value={d.servingsRemaining}
                step={1}
                onChange={(v) => set({ servingsRemaining: v })}
              />
            </Field>
            <Field label="Bottle">
              <NumberInput
                value={d.servingsPerContainer}
                step={1}
                onChange={(v) => set({ servingsPerContainer: v })}
              />
            </Field>
            <Field label="Per dose">
              <NumberInput
                value={d.servingsPerDose}
                step={1}
                min={1}
                onChange={(v) => set({ servingsPerDose: v })}
              />
            </Field>
          </div>
          <Field
            label="Remind me to reorder"
            hint={reorderHint(item, d.reorderAtDays ?? item.reorderAtDays, today)}
          >
            <ReorderLeadPicker
              value={d.reorderAtDays ?? item.reorderAtDays}
              onChange={(v) => set({ reorderAtDays: v, reorderCustom: true })}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const before = item.servingsRemaining;
                refill(item.id);
                set({ servingsRemaining: item.servingsPerContainer });
                toast(`New bottle: ${item.servingsPerContainer} left`, {
                  description: `Was ${before}. Tap Undo if that was a mistake.`,
                  duration: 8000,
                  action: {
                    label: "Undo",
                    onClick: () => {
                      useSupplime.getState().updateItem(item.id, { servingsRemaining: before });
                      set({ servingsRemaining: before });
                    },
                  },
                });
              }}
            >
              New bottle
            </Button>
            <Button variant="outline" size="sm" asChild>
              <a
                href={
                  item.source?.url ??
                  `https://www.iherb.com/search?kw=${encodeURIComponent(item.name)}`
                }
                target="_blank"
                rel="noreferrer"
              >
                Reorder on iHerb
              </a>
            </Button>
          </div>
        </Section>

        {!item.planned && (
          <Section
            title="History"
            hint="Forgot to log, or were away? Fix any day of the last 6 weeks."
          >
            <Button
              variant="outline"
              onClick={() => openOverlay({ kind: "history", itemId: item.id })}
            >
              Edit past days
            </Button>
          </Section>
        )}

        <Section title="Notes & check-ins">
          <Textarea
            value={d.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Brand, how it feels, anything worth remembering"
          />
          {history.length > 0 && (
            <ul className="space-y-1 text-xs text-muted-foreground">
              {history.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2">
                  <span>
                    {formatShortDate(e.date)} · day {daysBetween(item.startedAt, e.date) + 1} ·{" "}
                    <span className="text-foreground">{EFFECT_COPY[e.rating]}</span>
                    {e.sideEffects ? " · side effects" : ""}
                  </span>
                  <button
                    type="button"
                    className="min-h-9 px-2 underline"
                    onClick={() => removeEffect(e.id)}
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Pause or stop">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="paused">Pause</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                No reminders and not counted, until you switch it back.
              </p>
            </div>
            <Switch id="paused" checked={d.paused} onCheckedChange={(paused) => set({ paused })} />
          </div>
          <div className="flex flex-wrap gap-2">
            {item.archived ? (
              <Button
                variant="outline"
                onClick={() => {
                  restoreItem(item.id);
                  toast(`${item.name} is back in your cabinet`);
                }}
              >
                Start again
              </Button>
            ) : (
              <Button variant="outline" onClick={() => setStopOpen(true)}>
                Stop taking it
              </Button>
            )}
            <Button
              variant="ghost"
              className="text-destructive"
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            “Stop” keeps the history as a finished experiment. “Delete” erases it completely.
          </p>
        </Section>
      </div>

      <Confirm
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${item.name}?`}
        body="This removes it and all its doses, check-ins and decisions. If you just stopped taking it, use “Stop taking it” instead to keep the record."
        confirmLabel="Delete"
        onConfirm={() => {
          removeItem(item.id);
          toast(`${item.name} deleted`);
          onClose();
        }}
      />
      <StopSheet
        open={stopOpen}
        item={item}
        onClose={() => setStopOpen(false)}
        onStop={(verdict, note) => {
          archiveItem(item.id, verdict, note);
          toast(`${item.name} stopped`, { description: "Kept under past experiments in Journey." });
          onClose();
        }}
      />
    </Screen>
  );
}

export function StopSheet({
  open,
  item,
  onClose,
  onStop,
}: {
  open: boolean;
  item: StackItem;
  onClose: () => void;
  onStop: (verdict: Verdict, note?: string) => void;
}) {
  const [verdict, setVerdict] = useState<Verdict>("no-effect");
  const [note, setNote] = useState("");
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Stop ${item.name}`}
      description="Why are you stopping? It becomes part of your record."
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(VERDICT_COPY) as Verdict[]).map((v) => (
            <Chip key={v} on={verdict === v} onClick={() => setVerdict(v)}>
              {VERDICT_COPY[v]}
            </Chip>
          ))}
        </div>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note to future you (optional)"
        />
        <Button className="w-full" onClick={() => onStop(verdict, note)}>
          Stop and keep the record
        </Button>
      </div>
    </Sheet>
  );
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function RadioCard({
  on,
  onClick,
  title,
  detail,
}: {
  on: boolean;
  onClick: () => void;
  title: string;
  detail: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-colors",
        on ? "border-primary bg-accent/60" : "border-border bg-card",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
          on ? "border-primary" : "border-muted-foreground/40",
        )}
      >
        {on && <span className="size-2.5 rounded-full bg-primary" />}
      </span>
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </button>
  );
}

function pickTimeline(p: ReturnType<typeof profileFor>): TimelineValue {
  return {
    firstSignsDay: p.firstSignsDay,
    typicalDay: p.typicalDay,
    minDaysBeforeIncrease: p.minDaysBeforeIncrease,
    evaluateDay: p.evaluateDay,
  };
}

function sortKeys(o: object) {
  return Object.fromEntries(
    Object.entries(o)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b)),
  );
}

function reorderHint(item: StackItem, lead: number, today: string) {
  const left = daysOfStock(item);
  const runsOut = addDays(today, left);
  const orderBy = addDays(today, Math.max(0, left - lead));
  return `About ${left} days left: runs out ${formatShortDate(runsOut)}, so order by ${formatShortDate(orderBy)}.`;
}
