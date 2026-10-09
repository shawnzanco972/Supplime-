import { Flame, Shield } from "lucide-react";
import type { gameSummary } from "@/lib/game";
import { cn } from "@/lib/utils";

type Game = ReturnType<typeof gameSummary>;

/** Level, XP to the next level, streak with shields, and this week's target. */
export function LevelCard({
  game,
  compact = false,
  onOpen,
}: {
  game: Game;
  compact?: boolean;
  onOpen?: () => void;
}) {
  const { level, week } = game;
  const Wrapper = onOpen ? "button" : "div";
  return (
    <Wrapper
      {...(onOpen ? { type: "button" as const, onClick: onOpen } : {})}
      className="block w-full rounded-2xl bg-card p-4 text-left shadow-[var(--shadow-border)]"
    >
      <div className="flex items-center gap-4">
        <WeekRing
          rate={week.planned ? week.taken / Math.max(1, Math.ceil(week.planned * week.target)) : 0}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-base font-semibold">
              Level {level.level} · {level.name}
            </p>
            <p className="text-xs tabular-nums text-muted-foreground">{game.xp} XP</p>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${level.progress * 100}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {level.next ? `${level.next - game.xp} XP to ${level.nextName}` : "Top level reached"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <Flame
            className={cn("size-4", game.streak > 0 ? "text-warn" : "text-muted-foreground")}
          />
          <span className="font-medium tabular-nums">{game.streak}</span>
          <span className="text-muted-foreground">day streak</span>
        </span>
        <span
          className="inline-flex items-center gap-1"
          title="Shields protect your streak on a missed day"
        >
          {[0, 1, 2].map((i) => (
            <Shield
              key={i}
              className={cn(
                "size-4",
                i < game.shields ? "fill-primary/20 text-primary" : "text-muted",
              )}
            />
          ))}
          <span className="ml-1 text-muted-foreground">
            {game.shields} shield{game.shields === 1 ? "" : "s"}
          </span>
        </span>
        {!compact && (
          <span className="text-muted-foreground">
            Week {week.taken}/{Math.ceil(week.planned * week.target)} target
          </span>
        )}
      </div>
      {compact && week.planned > 0 && (
        <p className="mt-2 text-xs text-muted-foreground">
          {week.hit
            ? "Weekly target hit 🎯 — everything now is extra."
            : `This week: ${week.taken} of ${Math.ceil(week.planned * week.target)} doses for your ${Math.round(week.target * 100)}% target · ${week.needed} to go`}
        </p>
      )}
    </Wrapper>
  );
}

function WeekRing({ rate }: { rate: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, rate));
  return (
    <svg
      viewBox="0 0 56 56"
      className="size-14 shrink-0"
      aria-label={`Week ${Math.round(p * 100)}% of target`}
    >
      <g transform="rotate(-90 28 28)">
        <circle cx="28" cy="28" r={r} fill="none" stroke="var(--color-muted)" strokeWidth="6" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - p)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </g>
      <text x="28" y="32" textAnchor="middle" className="fill-foreground text-[13px] font-medium">
        {Math.round(p * 100)}%
      </text>
    </svg>
  );
}
