import { Clock, Home, RotateCcw, SkipForward } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { TimeInput } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/screen";
import { missedAdvice } from "@/lib/missed";
import { useNav } from "@/lib/nav";
import { effectiveSlotTimes, nowInDay } from "@/lib/protocol";
import { useSupplime } from "@/lib/store";
import { SLOTS, type MissReason, type SlotId } from "@/lib/types";
import { formatClock, formatHHMM } from "@/lib/utils";

/**
 * "Can't take it right now." Supplime asks why, then says whether this supplement
 * should be caught up later today (and when) or skipped, depending on how it works.
 */
export function NotNowSheet({
  itemId,
  slot,
  date,
}: {
  itemId: string;
  slot: SlotId;
  date: string;
}) {
  const close = useNav((s) => s.close);
  const item = useSupplime((s) => s.stack.find((i) => i.id === itemId));
  const profile = useSupplime((s) => s.profile);
  const days = useSupplime((s) => s.days);
  const logDose = useSupplime((s) => s.logDose);
  const deferDose = useSupplime((s) => s.deferDose);
  const [reason, setReason] = useState<MissReason | null>(null);
  const [customTime, setCustomTime] = useState<string | null>(null);
  if (!item) return null;

  const now = nowInDay(new Date(), profile.rhythm);
  const { times } = effectiveSlotTimes(profile, days, date);
  const advice =
    reason && reason !== "chose"
      ? missedAdvice({ item, slot, reason, now, times, rhythm: profile.rhythm })
      : null;
  const slotLabel = SLOTS.find((s) => s.id === slot)?.label ?? slot;

  const defer = (at: string, why: MissReason) => {
    deferDose(item.id, slot, at, why, date);
    toast(`${item.name}: reminder at ${formatClock(at)}`);
    close();
  };
  const skip = (why: MissReason) => {
    logDose(item.id, slot, "skipped", date, { reason: why });
    toast(`${item.name} skipped today`, {
      description: "Logged honestly: +2 XP. Carry on tomorrow.",
    });
    close();
  };

  return (
    <Sheet
      onClose={close}
      title={`${item.name} · ${slotLabel}`}
      description={reason ? undefined : "What's going on?"}
    >
      {!reason && (
        <div className="grid gap-2">
          <Option
            icon={<Clock className="size-5" />}
            title="Later today"
            detail="Remind me in an hour"
            onClick={() => defer(formatHHMM(now + 60), "chose")}
          />
          <Option
            icon={<Home className="size-5" />}
            title="Not with me"
            detail="I'll be home later"
            onClick={() => setReason("not-with-me")}
          />
          <Option
            icon={<RotateCcw className="size-5" />}
            title="I forgot / missed it"
            detail="What should I do now?"
            onClick={() => setReason("forgot")}
          />
          <Option
            icon={<SkipForward className="size-5" />}
            title="Skip today"
            detail="On purpose"
            onClick={() => skip("chose")}
          />
          <button
            type="button"
            className="mt-1 min-h-11 text-sm text-muted-foreground underline"
            onClick={() => skip("side-effects")}
          >
            Skip — it's giving me side effects
          </button>
        </div>
      )}

      {advice && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-secondary p-4">
            <p className="text-base font-semibold">{advice.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{advice.message}</p>
          </div>

          {advice.action !== "skip" && advice.suggestAt && (
            <>
              {reason === "forgot" && advice.suggestAt === formatHHMM(now) ? (
                <Button
                  className="w-full"
                  onClick={() => {
                    logDose(item.id, slot, "taken", date, { late: true, reason: "forgot" });
                    toast(`${item.name} taken (late)`, {
                      description: "A late dose still counts: +6 XP.",
                    });
                    close();
                  }}
                >
                  I'm taking it now
                </Button>
              ) : (
                <Button
                  className="w-full"
                  onClick={() => defer(customTime ?? advice.suggestAt!, reason!)}
                >
                  Remind me at {formatClock(customTime ?? advice.suggestAt)}
                </Button>
              )}
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">
                  Different time{advice.latest ? ` (until ${formatClock(advice.latest)})` : ""}
                </span>
                <TimeInput value={customTime ?? advice.suggestAt} onChange={setCustomTime} />
              </div>
              {customTime && advice.suggestAt === formatHHMM(now) && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => defer(customTime, reason!)}
                >
                  Remind me at {formatClock(customTime)}
                </Button>
              )}
            </>
          )}
          <Button
            variant={advice.action === "skip" ? "default" : "ghost"}
            className="w-full"
            onClick={() => skip(reason!)}
          >
            Skip today
          </Button>
          <button
            type="button"
            className="w-full text-sm text-muted-foreground underline"
            onClick={() => setReason(null)}
          >
            Back
          </button>
        </div>
      )}
    </Sheet>
  );
}

function Option({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl bg-secondary px-4 py-3 text-left transition-colors hover:bg-muted"
    >
      <span className="text-primary">{icon}</span>
      <span>
        <span className="block font-medium">{title}</span>
        <span className="block text-sm text-muted-foreground">{detail}</span>
      </span>
    </button>
  );
}
