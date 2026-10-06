import { toast } from "sonner";
import { EFFECT_COPY, effectWindow, latestEffect } from "@/lib/stats";
import { useSupplime } from "@/lib/store";
import type { EffectRating, StackItem } from "@/lib/types";
import { cn, formatShortDate, todayKey } from "@/lib/utils";

/** "Do you feel it?" — four taps, one per day per supplement. */
export function EffectCheckIn({ item, compact = false }: { item: StackItem; compact?: boolean }) {
  const effects = useSupplime((s) => s.effects);
  const logEffect = useSupplime((s) => s.logEffect);
  const today = todayKey();
  const last = latestEffect(item, effects);
  const todays = last?.date === today ? last : null;
  const w = effectWindow(item, today);

  return (
    <div className={cn(!compact && "rounded-xl bg-card p-4 shadow-[var(--shadow-border)]")}>
      {!compact && (
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-medium">{item.name}</p>
          <p className="text-xs tabular-nums text-muted-foreground">
            day {w.elapsed}
            {w.atDose !== w.elapsed ? ` · ${w.atDose} at this dose` : ""}
          </p>
        </div>
      )}
      <p className={cn("text-sm text-muted-foreground", !compact && "mt-1")}>
        {todays
          ? `Logged today: ${EFFECT_COPY[todays.rating]}`
          : last
            ? `Last check-in ${formatShortDate(last.date)}: ${EFFECT_COPY[last.rating]}. Feeling it now?`
            : "Are you noticing anything yet?"}
      </p>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {EFFECT_COPY.map((label, rating) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              logEffect(item.id, rating as EffectRating);
              toast(`${item.name}: ${label}`, {
                description:
                  rating >= 2
                    ? `Noted on day ${w.elapsed}. No need to raise a dose that already works.`
                    : "Noted. Supplime will ask again in a few days.",
              });
            }}
            className={cn(
              "min-h-11 rounded-lg px-1 text-xs leading-tight font-medium transition-colors",
              todays?.rating === rating
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
