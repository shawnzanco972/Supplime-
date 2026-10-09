import { UseTags } from "@/components/product-picker";
import { ChevronRight } from "lucide-react";
import { FlagChip } from "@/components/flag-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { foodLabel } from "@/lib/catalog";
import { stackWarnings } from "@/lib/flags";
import { journeyFor, PHASE_COPY } from "@/lib/journey";
import { useNav } from "@/lib/nav";
import { daysOfStock, isLowStock } from "@/lib/stats";
import { appToday, useSupplime } from "@/lib/store";
import { SLOTS, type StackItem } from "@/lib/types";
import { addDays, cn, formatShortDate } from "@/lib/utils";
import { contentsLabel } from "@/lib/products";

export function StackView() {
  const { stack, profile, logs, effects, decisions } = useSupplime();
  const open = useNav((s) => s.open);
  const today = appToday();
  const active = stack.filter((i) => !i.archived && !i.paused && !i.planned);
  const paused = stack.filter((i) => !i.archived && i.paused);
  const planned = stack.filter((i) => !i.archived && i.planned);
  const warnings = stackWarnings({ stack, times: profile.slotTimes, profile });
  const low = active.filter(isLowStock);

  const card = (item: StackItem) => {
    const j = journeyFor({ item, logs, effects, decisions, today });
    const phase = PHASE_COPY[j.phase];
    const days = daysOfStock(item);
    return (
      <button
        type="button"
        key={item.id}
        onClick={() => open({ kind: "editor", itemId: item.id })}
        className="flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-[var(--shadow-border)]"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{item.name}</p>
            {item.paused ? (
              <Badge>Paused</Badge>
            ) : (
              <span className="text-xs text-muted-foreground">{phase.label}</span>
            )}
          </div>
          <UseTags catalogId={item.catalogId} className="mt-1" />
          {item.product && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {item.product.brand} ·{" "}
              {contentsLabel(item.product.perUnit, item.servingsPerDose, item.product.form)}
            </p>
          )}
          <p className="mt-0.5 text-sm text-muted-foreground">
            {item.amount} {item.unit} · {foodLabel(item.foodTiming)} ·{" "}
            {item.slots.map((s) => SLOTS.find((x) => x.id === s)?.label).join(", ")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Day {j.day} · {j.atDose}d at this dose ·{" "}
            <span className={cn(isLowStock(item) && "font-medium text-warn")}>
              {item.planned
                ? "not started"
                : `${days}d supply · order by ${formatShortDate(addDays(today, Math.max(0, days - item.reorderAtDays)))}`}
            </span>
          </p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
      </button>
    );
  };

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Tap one to edit, pause, stop or delete</p>
          <h1 className="font-display text-3xl tracking-tight">Cabinet</h1>
        </div>
        <Button onClick={() => open({ kind: "add" })}>Add</Button>
      </header>

      {low.length > 0 && (
        <section className="rounded-2xl bg-secondary px-4 py-3">
          <p className="text-sm font-medium">Running low</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {low.map((i) => `${i.name} · ${daysOfStock(i)} days`).join(" · ")}
          </p>
        </section>
      )}

      {active.length === 0 && paused.length === 0 ? (
        <p className="text-muted-foreground">Nothing here yet. Add what you already take.</p>
      ) : (
        <div className="space-y-3">{active.map(card)}</div>
      )}

      {warnings.length > 0 && (
        <section className="space-y-2 rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
          <h2 className="font-display text-lg tracking-tight">Habit check</h2>
          <p className="text-sm text-muted-foreground">
            Things in your plan that clash with your day or each other.
          </p>
          <ul className="space-y-2">
            {warnings.map((w) => (
              <li key={`${w.item.id}-${w.slot}-${w.flag.text}`}>
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => open({ kind: "editor", itemId: w.item.id })}
                >
                  <p className="text-sm font-medium">
                    {w.item.name} · {SLOTS.find((s) => s.id === w.slot)?.label}
                  </p>
                  <FlagChip flag={w.flag} className="mt-1" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {planned.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-lg tracking-tight">Waiting to start</h2>
            <p className="text-sm text-muted-foreground">
              Owned, not started. Journey tells you when it's a good time.
            </p>
          </div>
          {planned.map(card)}
        </section>
      )}

      {paused.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-lg tracking-tight">Paused</h2>
          {paused.map(card)}
        </section>
      )}
    </div>
  );
}
