import { UseTags } from "@/components/product-picker";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { fitCheck } from "@/lib/advisor";
import { FlagChip } from "@/components/flag-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { foodLabel } from "@/lib/catalog";
import { stackWarnings } from "@/lib/flags";
import { stackCautions } from "@/lib/timing";
import { journeyFor, PHASE_COPY } from "@/lib/journey";
import { useNav } from "@/lib/nav";
import { daysOfStock, isLowStock } from "@/lib/stats";
import { appToday, useSupplime } from "@/lib/store";
import { SLOTS, type StackItem } from "@/lib/types";
import { addDays, cn, formatShortDate } from "@/lib/utils";
import { contentsLabel } from "@/lib/products";

/** Something not in the cabinet yet: ordered or just interested, with how it fits. */
function Incoming({
  item,
  today,
  line,
  action,
  onAction,
  onOpen,
}: {
  item: StackItem;
  today: string;
  line: string;
  action: string;
  onAction: () => void;
  onOpen: () => void;
}) {
  const stack = useSupplime((s) => s.stack);
  const notes = item.catalogId
    ? fitCheck(item.catalogId, { stack, today, arrivesOn: item.arrivesOn, excludeId: item.id })
    : [];
  const warn = notes.filter((n) => n.tone === "warn");
  const first = warn[0] ?? notes.find((n) => n.tone === "info");
  return (
    <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
      <button type="button" onClick={onOpen} className="w-full text-left">
        <p className="font-medium">{item.name}</p>
        <p className="text-xs text-muted-foreground">
          {item.product ? `${item.product.brand} · ` : ""}
          {line}
        </p>
        {first && (
          <p
            className={cn(
              "mt-1.5 text-sm",
              first.tone === "warn" ? "text-warn" : "text-muted-foreground",
            )}
          >
            {first.text}
          </p>
        )}
      </button>
      <Button size="sm" variant="outline" className="mt-3" onClick={onAction}>
        {action}
      </Button>
    </div>
  );
}

export function StackView() {
  const { stack, profile, logs, effects, decisions } = useSupplime();
  const open = useNav((s) => s.open);
  const today = appToday();
  const active = stack.filter((i) => !i.archived && !i.paused && !i.planned);
  const paused = stack.filter((i) => !i.archived && i.paused);
  const planned = stack.filter((i) => !i.archived && i.planned && !i.stage);
  const ordered = stack.filter((i) => !i.archived && i.stage === "ordered");
  const wishlist = stack.filter((i) => !i.archived && i.stage === "interested");
  const setStage = useSupplime((s) => s.setStage);
  const warnings = stackWarnings({ stack, times: profile.slotTimes, profile });
  const cautions = stackCautions(stack);
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
            {SLOTS.filter((x) => item.slots.includes(x.id))
              .map((x) => x.label)
              .join(", ")}
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

      {(warnings.length > 0 || cautions.length > 0) && (
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
            {cautions.map((c) => (
              <li key={c.text}>
                <p className="text-sm font-medium">{c.names.join(" + ")}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{c.text}</p>
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

      {ordered.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-lg tracking-tight">On the way</h2>
            <p className="text-sm text-muted-foreground">
              Ordered. Not on Today until you say it arrived.
            </p>
          </div>
          {ordered.map((item) => (
            <Incoming
              key={item.id}
              item={item}
              today={today}
              line={
                item.arrivesOn
                  ? item.arrivesOn <= today
                    ? `Due around ${formatShortDate(item.arrivesOn)}. Here yet?`
                    : `Arrives around ${formatShortDate(item.arrivesOn)}`
                  : "Ordered"
              }
              action="It arrived"
              onAction={() => {
                setStage(item.id, null);
                toast(`${item.name} is in your cabinet`, {
                  description: "Start it from here or Journey when it's a good time.",
                });
              }}
              onOpen={() => open({ kind: "editor", itemId: item.id })}
            />
          ))}
        </section>
      )}

      {wishlist.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="font-display text-lg tracking-tight">Interested</h2>
            <p className="text-sm text-muted-foreground">Things you're reading about.</p>
          </div>
          {wishlist.map((item) => (
            <Incoming
              key={item.id}
              item={item}
              today={today}
              line="Not ordered yet"
              action="I ordered it"
              onAction={() => {
                setStage(item.id, "ordered", addDays(today, 7));
                toast(`${item.name}: on the way`, {
                  description: "Arrival set to a week from now. Change it in its page.",
                });
              }}
              onOpen={() => open({ kind: "editor", itemId: item.id })}
            />
          ))}
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
