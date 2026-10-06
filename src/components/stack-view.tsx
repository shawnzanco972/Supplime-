import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EffectCheckIn } from "@/components/effect-check-in";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { CATALOG_BY_ID, foodLabel } from "@/lib/catalog";
import { useNav } from "@/lib/nav";
import { timingConflict } from "@/lib/protocol";
import {
  EFFECT_COPY,
  currentStep,
  daysOfStock,
  effectHistory,
  effectWindow,
  firstFelt,
  isLowStock,
  latestEffect,
  takenDays,
} from "@/lib/stats";
import { useSupplime } from "@/lib/store";
import { FOOD_TIMINGS, SLOTS, type FoodTiming, type SlotId, type StackItem } from "@/lib/types";
import { cn, daysBetween, formatShortDate, todayKey } from "@/lib/utils";

export function StackView({ onAdd }: { onAdd: () => void }) {
  const stack = useSupplime((s) => s.stack);
  const focusItem = useNav((s) => s.focusItem);
  const clearFocus = useNav((s) => s.clearFocus);
  const [editing, setEditing] = useState<string | null>(null);
  const item = stack.find((s) => s.id === editing) ?? null;
  const low = stack.filter((i) => !i.paused && isLowStock(i));

  useEffect(() => {
    if (focusItem) {
      setEditing(focusItem);
      clearFocus();
    }
  }, [focusItem, clearFocus]);

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Protocol</p>
          <h1 className="font-display text-3xl tracking-tight">Stack</h1>
        </div>
        <Button onClick={onAdd}>Add</Button>
      </header>

      {low.length > 0 && (
        <section className="rounded-xl bg-secondary px-4 py-3">
          <p className="text-sm font-medium">Running low</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {low.map((i) => `${i.name} · ${daysOfStock(i)} days`).join(" · ")}
          </p>
        </section>
      )}

      {stack.length === 0 ? (
        <p className="text-muted-foreground">Nothing here yet. Add what you already take.</p>
      ) : (
        <div className="space-y-3">
          {stack.map((entry) => (
            <StackCard key={entry.id} item={entry} onOpen={() => setEditing(entry.id)} />
          ))}
        </div>
      )}

      {item && <EditItem item={item} onClose={() => setEditing(null)} />}
    </div>
  );
}

function StackCard({ item, onOpen }: { item: StackItem; onOpen: () => void }) {
  const logs = useSupplime((s) => s.logs);
  const effects = useSupplime((s) => s.effects);
  const w = effectWindow(item);
  const days = daysOfStock(item);
  const conflict = timingConflict(item);
  const taken = takenDays(item, logs);
  const felt = firstFelt(item, effects);
  const last = latestEffect(item, effects);
  const step = currentStep(item);
  const today = todayKey();

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-xl bg-card p-4 text-left shadow-[var(--shadow-border)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{item.name}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {item.amount} {item.unit} · {foodLabel(item.foodTiming)} ·{" "}
            {item.slots.map((s) => SLOTS.find((x) => x.id === s)?.label).join(", ")}
          </p>
        </div>
        {item.paused ? (
          <Badge>Paused</Badge>
        ) : isLowStock(item) ? (
          <Badge variant="warn">{days}d left</Badge>
        ) : (
          <Badge variant="ok">{days}d</Badge>
        )}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Fact value={`${w.elapsed}`} label={w.elapsed === 1 ? "day on it" : "days on it"} />
        <Fact value={`${taken}`} label={taken === 1 ? "day taken" : "days taken"} />
        <Fact value={`${w.atDose}`} label={`at ${step.amount} ${step.unit}`} />
      </div>

      <p className="mt-3 text-sm">{w.label}</p>
      <Progress className="mt-2" value={w.progress * 100} />

      <p className="mt-2 text-xs text-muted-foreground">
        {felt
          ? `First felt on day ${felt.day} (${formatShortDate(felt.log.date)}).`
          : last
            ? `Last check-in: ${EFFECT_COPY[last.rating]}.`
            : "No effect check-ins yet."}{" "}
        {felt && last && last.rating >= 2
          ? "It is working: hold this dose."
          : w.readyToIncrease
            ? "Dose review is due."
            : `Dose review ${reviewLabel(w.reviewOn, today)}.`}
      </p>
      {conflict && <p className="mt-2 text-xs text-warn">{conflict}</p>}
    </button>
  );
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function reviewLabel(reviewOn: string, today: string) {
  const d = daysBetween(today, reviewOn);
  if (d <= 0) return "today";
  if (d === 1) return "tomorrow";
  return `in ${d} days (${formatShortDate(reviewOn)})`;
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-secondary/70 px-2 py-2">
      <p className="font-display text-lg leading-none tabular-nums">{value}</p>
      <p className="mt-1 truncate text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function EditItem({ item, onClose }: { item: StackItem; onClose: () => void }) {
  const updateItem = useSupplime((s) => s.updateItem);
  const changeDose = useSupplime((s) => s.changeDose);
  const removeItem = useSupplime((s) => s.removeItem);
  const removeEffect = useSupplime((s) => s.removeEffect);
  const refill = useSupplime((s) => s.refill);
  const logs = useSupplime((s) => s.logs);
  const effects = useSupplime((s) => s.effects);
  const cat = item.catalogId ? CATALOG_BY_ID[item.catalogId] : undefined;
  const w = effectWindow(item);
  const today = todayKey();
  const [newDose, setNewDose] = useState(String(item.amount));
  const [confirmRemove, setConfirmRemove] = useState(false);
  const history = effectHistory(item, effects).slice(-6).reverse();
  const felt = firstFelt(item, effects);
  const lastFelt = latestEffect(item, effects);

  function toggleSlot(id: SlotId) {
    const next = item.slots.includes(id) ? item.slots.filter((s) => s !== id) : [...item.slots, id];
    if (next.length === 0) return;
    updateItem(item.id, { slots: next });
  }

  const doseValue = Number(newDose);
  const doseChanged = Number.isFinite(doseValue) && doseValue > 0 && doseValue !== item.amount;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {cat && <p className="text-sm text-muted-foreground">{cat.summary}</p>}

          <section className="space-y-2 rounded-lg bg-secondary px-3 py-3 text-sm">
            <p>
              <span className="font-medium">Day {w.elapsed}</span> ·{" "}
              {plural(takenDays(item, logs), "day")} logged as taken · {plural(w.atDose, "day")} at
              the current dose.
            </p>
            <p className="text-muted-foreground">{w.detail}</p>
            {felt && lastFelt && lastFelt.rating >= 2 ? (
              <p>
                You first felt it on day {felt.day}. It is working, so there is no reason to raise
                the dose.
              </p>
            ) : w.readyToIncrease ? (
              <p>
                <span className="font-medium">Dose review is due.</span> {w.increaseGuidance}
              </p>
            ) : (
              <p>
                Hold this dose until {formatShortDate(w.reviewOn)} ({reviewLabel(w.reviewOn, today)}
                ) before judging it or stepping up.
              </p>
            )}
            {cat && (
              <p className="text-xs text-muted-foreground">
                Typical ceiling: {cat.typicalCeiling}.
              </p>
            )}
          </section>

          <section>
            <Label>How does it feel today?</Label>
            <div className="mt-2">
              <EffectCheckIn item={item} compact />
            </div>
            {history.length > 0 && (
              <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                {history.map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2">
                    <span>
                      {formatShortDate(e.date)} · day {daysBetween(item.startedAt, e.date) + 1} ·{" "}
                      <span className="text-foreground">{EFFECT_COPY[e.rating]}</span>
                    </span>
                    <button
                      type="button"
                      className="px-2 py-1 underline"
                      onClick={() => removeEffect(e.id)}
                    >
                      remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <Label htmlFor="dose">Dose ({item.unit})</Label>
            <div className="mt-2 flex gap-2">
              <Input
                id="dose"
                type="number"
                inputMode="decimal"
                value={newDose}
                onChange={(e) => setNewDose(e.target.value)}
              />
              <Button
                disabled={!doseChanged}
                onClick={() => {
                  changeDose(item.id, doseValue);
                  toast(`${item.name}: ${doseValue} ${item.unit} from today`, {
                    description: "The dose-review clock restarts from today.",
                  });
                }}
              >
                {item.startedAt >= today ? "Save" : "Start today"}
              </Button>
            </div>
            <ol className="mt-3 space-y-1 text-xs text-muted-foreground">
              {[...item.doseHistory].reverse().map((step, i) => (
                <li key={`${step.date}-${i}`}>
                  {i === 0 ? "Now" : "Before"}: {step.amount} {step.unit} since{" "}
                  {formatShortDate(step.date)}
                </li>
              ))}
            </ol>
          </section>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="started">Started on</Label>
              <Input
                id="started"
                className="mt-2"
                type="date"
                max={today}
                value={item.startedAt}
                onChange={(e) =>
                  e.target.value && updateItem(item.id, { startedAt: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="unit">Unit</Label>
              <Input
                id="unit"
                className="mt-2"
                value={item.unit}
                onChange={(e) => updateItem(item.id, { unit: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Food</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {FOOD_TIMINGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => updateItem(item.id, { foodTiming: t as FoodTiming })}
                  className={cn(
                    "h-10 rounded-full px-3 text-xs font-medium",
                    item.foodTiming === t ? "bg-primary text-primary-foreground" : "bg-secondary",
                  )}
                >
                  {foodLabel(t)}
                </button>
              ))}
            </div>
            {cat && <p className="mt-2 text-xs text-muted-foreground">{cat.foodWhy}</p>}
          </div>

          <div>
            <Label>Windows</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {SLOTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleSlot(s.id)}
                  className={cn(
                    "h-10 rounded-full px-3 text-xs font-medium",
                    item.slots.includes(s.id)
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary",
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
            {timingConflict(item) && (
              <p className="mt-2 text-xs text-warn">{timingConflict(item)}</p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <NumberField
              label="Servings left"
              value={item.servingsRemaining}
              onChange={(v) => updateItem(item.id, { servingsRemaining: v })}
            />
            <NumberField
              label="Bottle size"
              value={item.servingsPerContainer}
              onChange={(v) => updateItem(item.id, { servingsPerContainer: v })}
            />
            <NumberField
              label="Per dose"
              value={item.servingsPerDose}
              onChange={(v) => updateItem(item.id, { servingsPerDose: Math.max(1, v) })}
            />
          </div>
          <NumberField
            label="Warn me when this many days are left"
            value={item.reorderAtDays}
            onChange={(v) => updateItem(item.id, { reorderAtDays: v })}
          />

          <div className="flex items-center justify-between rounded-lg bg-secondary px-3 py-2">
            <div>
              <Label htmlFor="paused">Paused</Label>
              <p className="mt-1 text-xs text-muted-foreground">
                No reminders, not counted in your streak.
              </p>
            </div>
            <Switch
              id="paused"
              checked={item.paused}
              onCheckedChange={(v) => updateItem(item.id, { paused: v })}
            />
          </div>

          {cat?.caution && <p className="text-xs text-muted-foreground">{cat.caution}</p>}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => {
                refill(item.id);
                toast(`Refilled ${item.name}`);
              }}
            >
              Refill bottle
            </Button>
            <Button variant="outline" asChild>
              <a
                href={`https://www.amazon.com/s?k=${encodeURIComponent(item.name + " supplement")}`}
                target="_blank"
                rel="noreferrer"
              >
                Order
              </a>
            </Button>
            <Button
              variant="ghost"
              className="ml-auto text-destructive"
              onClick={() => {
                if (!confirmRemove) {
                  setConfirmRemove(true);
                  return;
                }
                removeItem(item.id);
                onClose();
              }}
            >
              {confirmRemove ? "Tap again to delete history" : "Remove"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <div>
      <Label className="text-xs leading-tight">{label}</Label>
      <Input
        className="mt-2"
        type="number"
        inputMode="numeric"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value !== "" && Number.isFinite(n) && n >= 0) onChange(n);
        }}
      />
    </div>
  );
}
