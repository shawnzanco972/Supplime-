import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { nextAsk } from "@/lib/advisor";
import { XP } from "@/lib/game";
import { AREA_COPY, AREA_LABEL, profileFor } from "@/lib/knowledge";
import { effectWindow } from "@/lib/stats";
import { appToday, useSupplime } from "@/lib/store";
import type { EffectRating, StackItem } from "@/lib/types";
import { cn } from "@/lib/utils";

/** One concrete question about one area ("Is your focus sharper?"), four taps. */
export function EffectCheckIn({ item, compact = false }: { item: StackItem; compact?: boolean }) {
  const effects = useSupplime((s) => s.effects);
  const logEffect = useSupplime((s) => s.logEffect);
  const today = appToday();
  const asks = profileFor(item).asks;
  const [area, setArea] = useState(() => nextAsk(item, effects).area);
  const ask = asks.find((a) => a.area === area) ?? asks[0]!;
  const todays = effects.find(
    (e) => e.itemId === item.id && e.date === today && (e.area ?? asks[0]!.area) === ask.area,
  );
  const w = effectWindow(item, today);

  return (
    <div className={cn(!compact && "rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]")}>
      {!compact && (
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-medium">{item.name}</p>
          <p className="text-xs tabular-nums text-muted-foreground">
            day {w.elapsed} · most feel it by day {w.typicalDay}
          </p>
        </div>
      )}
      {asks.length > 1 && (
        <div className="mt-2 flex gap-1.5">
          {asks.map((a) => (
            <button
              key={a.area}
              type="button"
              onClick={() => setArea(a.area)}
              className={cn(
                "min-h-8 rounded-full px-3 text-xs font-medium",
                a.area === ask.area
                  ? "bg-accent text-accent-foreground"
                  : "bg-secondary text-muted-foreground",
              )}
            >
              {AREA_LABEL[a.area] ?? a.area}
            </button>
          ))}
        </div>
      )}
      <p className={cn("text-sm", !compact && "mt-2")}>{ask.question}</p>
      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {AREA_COPY.map((label, rating) => (
          <button
            key={label}
            type="button"
            onClick={() => {
              logEffect(item.id, rating as EffectRating, { area: ask.area });
              toast(
                `${item.name} · ${AREA_LABEL[ask.area] ?? "overall"}: ${label}${todays ? "" : ` · +${XP.checkIn} XP`}`,
                {
                  description:
                    rating >= 2
                      ? `Noted on day ${w.elapsed}. No need to raise a dose that already works.`
                      : `Noted on day ${w.elapsed}. Most people feel it around day ${w.typicalDay}.`,
                },
              );
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

/** "Any of these lately?" — side effects worth knowing about, a few times per supplement. */
export function SafetyCheck({ item, onDone }: { item: StackItem; onDone?: () => void }) {
  const logSafety = useSupplime((s) => s.logSafety);
  const watch = profileFor(item).watch;
  const [picked, setPicked] = useState<string[]>([]);
  return (
    <div className="rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
      <p className="text-xs font-medium text-muted-foreground">Quick safety check</p>
      <p className="mt-1 font-medium">{item.name}: any of these lately?</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {watch.map((w) => {
          const on = picked.includes(w);
          return (
            <button
              key={w}
              type="button"
              onClick={() => setPicked((p) => (on ? p.filter((x) => x !== w) : [...p, w]))}
              className={cn(
                "min-h-10 rounded-full px-3 text-sm",
                on ? "bg-warn/15 text-warn" : "bg-secondary",
              )}
            >
              {w}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex gap-2">
        <Button
          variant={picked.length ? "outline" : "default"}
          className="flex-1"
          onClick={() => {
            logSafety(item.id, []);
            toast(`All good · +${XP.safety} XP`);
            onDone?.();
          }}
        >
          None of these
        </Button>
        {picked.length > 0 && (
          <Button
            className="flex-1"
            onClick={() => {
              logSafety(item.id, picked);
              toast(`Noted · +${XP.safety} XP`, {
                description: "Supplime will suggest a lower dose or a pause in Journey.",
              });
              onDone?.();
            }}
          >
            Report {picked.length}
          </Button>
        )}
      </div>
    </div>
  );
}
