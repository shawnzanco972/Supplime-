import { Coffee, Moon, Shuffle, Sun, Utensils, Wine } from "lucide-react";
import type { Flag } from "@/lib/flags";
import { cn } from "@/lib/utils";

const ICONS = {
  food: Utensils,
  coffee: Coffee,
  alcohol: Wine,
  moon: Moon,
  sun: Sun,
  split: Shuffle,
} as const;

export function FlagChip({ flag, className }: { flag: Flag; className?: string }) {
  const Icon = ICONS[flag.icon];
  return (
    <span
      className={cn(
        "inline-flex items-start gap-1.5 rounded-lg px-2 py-1 text-xs leading-snug",
        flag.tone === "warn" && "bg-warn/12 text-warn",
        flag.tone === "good" && "bg-accent text-accent-foreground",
        flag.tone === "info" && "bg-secondary text-muted-foreground",
        className,
      )}
    >
      <Icon className="mt-0.5 size-3.5 shrink-0" />
      <span>{flag.text}</span>
    </span>
  );
}
