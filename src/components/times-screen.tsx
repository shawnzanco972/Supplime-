import { CalendarDays, ChevronDown } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { Chip } from "@/components/fields";
import { Screen } from "@/components/ui/screen";
import { dosesByTime, timeSummary, type TimedDay } from "@/lib/insights";
import { useNav } from "@/lib/nav";
import { appToday, useSupplime } from "@/lib/store";
import { SLOTS } from "@/lib/types";
import { cn, formatClock, formatHHMM, formatShortDate, parseISODate } from "@/lib/utils";

/** One colour per supplement, in cabinet order. */
export const DOSE_COLORS = [
  "#3d5a4c",
  "#b7791f",
  "#6b7fa6",
  "#9a6b8f",
  "#4f9a94",
  "#c0565b",
  "#7a8a3a",
];
const clock = (m: number) => formatClock(formatHHMM(m));
const slotLabel = (id: string) => SLOTS.find((s) => s.id === id)?.label.toLowerCase() ?? id;

/**
 * When you took each supplement, day by day: a dot per dose on that day's time line, with
 * its window marked, and the day's watch numbers one tap away.
 */
export function TimesScreen({ itemId }: { itemId?: string }) {
  const close = useNav((s) => s.close);
  const open = useNav((s) => s.open);
  const { stack, logs, body, days, profile } = useSupplime();
  const today = appToday();
  const [weeks, setWeeks] = useState(4);
  const [only, setOnly] = useState<string | null>(itemId ?? null);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const timed = useMemo(
    () => dosesByTime({ stack, logs, body, days, profile, today, count: weeks * 7 }),
    [stack, logs, body, days, profile, today, weeks],
  );
  const items = stack.filter(
    (i) => !i.planned && timed.some((d) => d.doses.some((x) => x.item.id === i.id)),
  );
  const color = (id: string) =>
    DOSE_COLORS[
      Math.max(
        0,
        stack.findIndex((i) => i.id === id),
      ) % DOSE_COLORS.length
    ]!;
  const lanes = Math.max(1, items.length);
  const laneOf = (id: string) =>
    Math.max(
      0,
      items.findIndex((i) => i.id === id),
    );
  const shown = (d: TimedDay) => d.doses.filter((x) => !only || x.item.id === only);

  // The time axis: from the earliest dose (or your wake time) to the latest (or bedtime).
  const all = timed.flatMap((d) => shown(d).flatMap((x) => [x.minutes, x.planned]));
  const wake = parseHHMMLocal(profile.rhythm.wake);
  const lo = Math.floor(Math.min(wake, ...all) / 60) * 60;
  const hi = Math.ceil(Math.max(lo + 12 * 60, ...all) / 60) * 60;
  const pos = (m: number) => `${((m - lo) / (hi - lo)) * 100}%`;
  const ticks: number[] = [];
  const step = hi - lo > 14 * 60 ? 240 : 180;
  for (let m = lo; m <= hi; m += step) ticks.push(m);

  return (
    <Screen
      onClose={close}
      title="Dose times"
      subtitle="When you took each one, next to that day's numbers"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Chip on={!only} onClick={() => setOnly(null)}>
              All
            </Chip>
            {items.map((i) => (
              <Chip key={i.id} on={only === i.id} onClick={() => setOnly(i.id)}>
                <span
                  className="mr-1.5 inline-block size-2 rounded-full"
                  style={{ background: color(i.id) }}
                />
                {i.name}
              </Chip>
            ))}
          </div>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Times show up here for doses you log in the app on the day. Fixes made later have no
            real time, so they're left out.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {(only ? items.filter((i) => i.id === only) : items).map((i) => {
              const s = timeSummary(timed, i.id);
              if (!s) return null;
              return (
                <li key={i.id} className="flex items-baseline gap-2">
                  <span
                    className="inline-block size-2 shrink-0 rounded-full"
                    style={{ background: color(i.id) }}
                  />
                  <span>
                    <span className="font-medium">{i.name}</span> usually {clock(s.typical)}
                    <span className="text-muted-foreground">
                      {" "}
                      · {clock(s.earliest)}–{clock(s.latest)}
                      {s.late ? ` · late on ${s.late} day${s.late === 1 ? "" : "s"}` : ""}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <div className="rounded-2xl bg-card p-3 shadow-[var(--shadow-border)]">
          <div className="relative ml-14 h-4 text-[10px] text-muted-foreground">
            {ticks.map((m, i) => (
              <span
                key={m}
                className={cn(
                  "absolute whitespace-nowrap tabular-nums",
                  i === 0 ? "" : i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2",
                )}
                style={{ left: pos(m) }}
              >
                {clock(m).replace(":00", "")}
              </span>
            ))}
          </div>
          <div className="mt-1 divide-y divide-border/60">
            {timed.map((d) => {
              const doses = shown(d);
              const used = d.doses.length > 0 || d.skipped.length > 0;
              const isOpen = openDay === d.date;
              const windows = [...new Set(doses.map((x) => x.planned))];
              return (
                <Fragment key={d.date}>
                  <button
                    type="button"
                    onClick={() => setOpenDay(isOpen ? null : d.date)}
                    aria-expanded={isOpen}
                    className={cn(
                      "flex w-full items-center text-left",
                      !only && items.length > 2 ? "h-10" : "h-8",
                    )}
                  >
                    <span
                      className={cn(
                        "w-14 shrink-0 text-[11px] tabular-nums",
                        d.date === today ? "font-semibold" : "text-muted-foreground",
                      )}
                    >
                      {dayLabel(d.date, today)}
                    </span>
                    <span className="relative h-full flex-1">
                      {ticks.map((m) => (
                        <span
                          key={m}
                          className="absolute inset-y-1 w-px bg-border/70"
                          style={{ left: pos(m) }}
                        />
                      ))}
                      {windows.map((m) => (
                        <span
                          key={m}
                          className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded bg-muted-foreground/30"
                          style={{ left: pos(m) }}
                        />
                      ))}
                      {doses.map((x, k) => {
                        // Each supplement on its own little lane, so doses taken together stay visible.
                        const lane = only ? 0 : laneOf(x.item.id) - (lanes - 1) / 2;
                        return (
                          <span
                            key={`${x.item.id}-${x.slot}-${k}`}
                            title={`${x.item.name} ${clock(x.minutes)}`}
                            className={cn(
                              "absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full",
                              x.late && "ring-2 ring-warn/70",
                            )}
                            style={{
                              left: pos(x.minutes),
                              top: `calc(50% + ${lane * 6}px)`,
                              background: color(x.item.id),
                            }}
                          />
                        );
                      })}
                      {!used && (
                        <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-border" />
                      )}
                    </span>
                  </button>
                  {isOpen && (
                    <DayDetail
                      day={d}
                      only={only}
                      onFix={() =>
                        open({ kind: "history", itemId: only ?? undefined, date: d.date })
                      }
                    />
                  )}
                </Fragment>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-3 w-0.5 rounded bg-muted-foreground/30" /> its window
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block size-2 rounded-full bg-primary ring-2 ring-warn/70" /> 2
              h+ late
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-4 border-t border-dashed border-border" /> nothing
              logged that day
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setWeeks(weeks + 4)}
            className="flex min-h-11 items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:underline"
          >
            <ChevronDown className="size-4" /> 4 more weeks
          </button>
          <button
            type="button"
            onClick={() => open({ kind: "history", itemId: only ?? undefined })}
            className="flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline-offset-2 hover:underline"
          >
            <CalendarDays className="size-4" /> Fix past days
          </button>
        </div>
      </div>
    </Screen>
  );
}

function DayDetail({
  day,
  only,
  onFix,
}: {
  day: TimedDay;
  only: string | null;
  onFix: () => void;
}) {
  const doses = day.doses.filter((x) => !only || x.item.id === only);
  const skipped = day.skipped.filter((x) => !only || x.item.id === only);
  const v = day.vitals;
  const vitals = [
    v.sleepAfter !== undefined && `slept ${v.sleepAfter} h that night`,
    v.restingHr !== undefined && `resting HR ${v.restingHr}`,
    v.hrv !== undefined && `HRV ${v.hrv}`,
    v.steps !== undefined && `${v.steps.toLocaleString()} steps`,
    v.spo2 !== undefined && `SpO₂ ${v.spo2}%`,
  ].filter(Boolean);
  const f = day.feel;
  return (
    <div className="space-y-1.5 rounded-xl bg-secondary/70 px-3 py-2.5 text-sm">
      <p className="font-medium">{formatShortDate(day.date)}</p>
      {doses.length === 0 && skipped.length === 0 && (
        <p className="text-muted-foreground">Nothing logged in the app that day.</p>
      )}
      {doses.map((x, k) => {
        const off = x.minutes - x.planned;
        return (
          <p key={k}>
            {x.item.name} <span className="tabular-nums">{clock(x.minutes)}</span>
            <span className="text-muted-foreground">
              {" "}
              · {slotLabel(x.slot)} {clock(x.planned)}
              {off > 20 ? `, ${fmtLate(off)} later` : off < -20 ? `, ${fmtLate(-off)} early` : ""}
            </span>
          </p>
        );
      })}
      {skipped.map((x, k) => (
        <p key={`s${k}`} className="text-muted-foreground">
          {x.item.name}: skipped
        </p>
      ))}
      <p className="text-muted-foreground">
        {vitals.length ? `Watch: ${vitals.join(" · ")}` : "No watch data for this day."}
      </p>
      {f && (f.energy !== undefined || f.notes) && (
        <p className="text-muted-foreground">
          {f.energy !== undefined
            ? `Felt: energy ${f.energy} · mood ${f.mood ?? "–"} · focus ${f.focus ?? "–"}${f.calm !== undefined ? ` · calm ${f.calm}` : ""}`
            : ""}
          {f.notes ? `${f.energy !== undefined ? " · " : ""}“${f.notes}”` : ""}
        </p>
      )}
      <button
        type="button"
        onClick={onFix}
        className="text-xs font-medium text-primary underline-offset-2 hover:underline"
      >
        Fix this day
      </button>
    </div>
  );
}

const fmtLate = (m: number) =>
  m >= 60 ? `${Math.floor(m / 60)} h${m % 60 >= 10 ? ` ${m % 60} min` : ""}` : `${m} min`;

function dayLabel(date: string, today: string) {
  if (date === today) return "Today";
  const d = parseISODate(date);
  return `${d.toLocaleDateString(undefined, { weekday: "short" })} ${d.getDate()}`;
}

function parseHHMMLocal(t: string) {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}
