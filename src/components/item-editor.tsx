import { useMemo, useState } from "react";
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
} from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Confirm, Screen, Sheet } from "@/components/ui/screen";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { KNOWLEDGE, profileFor } from "@/lib/knowledge";
import { useNav } from "@/lib/nav";
import { EFFECT_COPY, daysOfStock, effectHistory } from "@/lib/stats";
import { appToday, useSupplime, type ItemDraft } from "@/lib/store";
import type { HabitRule, ItemOverrides, MissedMode, StackItem, Verdict } from "@/lib/types";
import { daysBetween, formatShortDate } from "@/lib/utils";

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
  const effects = useSupplime((s) => s.effects);
  const saveItem = useSupplime((s) => s.saveItem);
  const removeItem = useSupplime((s) => s.removeItem);
  const archiveItem = useSupplime((s) => s.archiveItem);
  const restoreItem = useSupplime((s) => s.restoreItem);
  const refill = useSupplime((s) => s.refill);
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
  });
  const set = (patch: Partial<typeof d>) => setD((prev) => ({ ...prev, ...patch }));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [stopOpen, setStopOpen] = useState(false);

  const doseChanged = d.amount !== undefined && d.amount > 0 && d.amount !== item.amount;

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
      amount: d.amount,
      doseChange: d.doseChange,
      startedAt: d.startedAt,
      slots: d.slots,
      foodTiming: d.foodTiming,
      servingsRemaining: d.servingsRemaining ?? item.servingsRemaining,
      servingsPerContainer: d.servingsPerContainer ?? item.servingsPerContainer,
      servingsPerDose: Math.max(1, d.servingsPerDose ?? item.servingsPerDose),
      reorderAtDays: d.reorderAtDays ?? item.reorderAtDays,
      servingLabel: d.servingLabel.trim() || undefined,
      notes: d.notes,
      paused: d.paused,
      overrides: Object.keys(overrides).length ? overrides : undefined,
    };
  }, [d, guide, item]);

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
      overrides: item.overrides && Object.keys(item.overrides).length ? item.overrides : undefined,
    };
    const { doseChange: _ignored, ...now } = draft;
    return JSON.stringify(sortKeys(before)) !== JSON.stringify(sortKeys(now));
  }, [draft, item]);

  function save() {
    saveItem(item.id, draft);
    toast(`Saved ${draft.name}`, {
      description:
        doseChanged && d.doseChange === "new-step"
          ? `${d.amount} ${draft.unit} from today. The dose clock restarts.`
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

        <Section title="Dose">
          {isCustom && (
            <Field label="Name" htmlFor="name">
              <Input id="name" value={d.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
          )}
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Field label="Amount per dose" htmlFor="amount">
              <NumberInput id="amount" value={d.amount} onChange={(amount) => set({ amount })} />
            </Field>
            <Field label="Unit" htmlFor="unit">
              <Input id="unit" value={d.unit} onChange={(e) => set({ unit: e.target.value })} />
            </Field>
          </div>
          {doseChanged && item.startedAt < today && (
            <div className="space-y-2 rounded-xl bg-secondary p-3">
              <p className="text-sm font-medium">What kind of change is this?</p>
              <div className="flex flex-wrap gap-2">
                <Chip
                  on={d.doseChange === "new-step"}
                  onClick={() => set({ doseChange: "new-step" })}
                >
                  New dose from today
                </Chip>
                <Chip
                  on={d.doseChange === "correction"}
                  onClick={() => set({ doseChange: "correction" })}
                >
                  Fixing a typo
                </Chip>
              </div>
              <p className="text-xs text-muted-foreground">
                {d.doseChange === "new-step"
                  ? `Supplime starts a new step and waits ${p.minDaysBeforeIncrease} days before suggesting another change.`
                  : "The current step's dose is corrected; your timeline stays as it is."}
              </p>
            </div>
          )}
          <Field label="Strength per capsule (optional)" hint='For example "1 capsule = 500 mg".'>
            <Input
              value={d.servingLabel}
              onChange={(e) => set({ servingLabel: e.target.value })}
              placeholder="1 capsule = 500 mg"
            />
          </Field>
          {item.doseHistory.length > 1 && (
            <ol className="space-y-1 text-xs text-muted-foreground">
              {[...item.doseHistory].reverse().map((step, i) => (
                <li key={`${step.date}-${i}`}>
                  {i === 0 ? "Now" : "Before"}: {step.amount} {step.unit} from{" "}
                  {formatShortDate(step.date)}
                </li>
              ))}
            </ol>
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
          <SlotPicker
            value={d.slots}
            onChange={(slots) => set({ slots })}
            times={profile.slotTimes}
          />
          <Field label="Food">
            <FoodPicker value={d.foodTiming} onChange={(foodTiming) => set({ foodTiming })} />
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
          <div className="flex items-center justify-between gap-3">
            <Label>Warn me with this many days left</Label>
            <NumberInput
              className="w-24"
              step={1}
              value={d.reorderAtDays}
              onChange={(v) => set({ reorderAtDays: v })}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refill(item.id);
                set({ servingsRemaining: item.servingsPerContainer });
                toast(`Refilled ${item.name}`);
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
                  toast(`${item.name} is back in your stack`);
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
