import { pillTooStrong } from "@/lib/knowledge";
import { useMemo, useState } from "react";
import {
  Chip,
  ConsistencyPicker,
  Field,
  FoodOkPicker,
  MissedPicker,
  NumberInput,
  RulesEditor,
  Section,
  SlotHintPicker,
  StartedPicker,
  Stepper,
  TimelineFields,
  type Consistency,
  type TimelineValue,
} from "@/components/fields";
import { BrandBadge, iconFor, type Picked } from "@/components/product-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CATALOG_BY_ID } from "@/lib/catalog";
import { profileFor } from "@/lib/knowledge";
import { contentsLabel, unitWord } from "@/lib/products";
import type { NewItem } from "@/lib/store";
import type {
  FoodTiming,
  HabitRule,
  ItemOverrides,
  ItemProduct,
  MissedMode,
  SlotId,
  SlotTimes,
  StackItem,
} from "@/lib/types";
import { cn, daysBetween } from "@/lib/utils";

export type SetupSeed = Picked & {
  name?: string;
  amount?: number;
  unit?: string;
  count?: number;
  source?: StackItem["source"];
};

/**
 * Everything needed to add one supplement, pre-filled from the guide and the bottle:
 * pills per dose, when, food, bottle size, and whether you're already taking it.
 */
export function ItemSetupForm({
  seed,
  today,
  times,
  submitLabel,
  onSubmit,
}: {
  seed: SetupSeed;
  today: string;
  times: SlotTimes;
  submitLabel: string;
  onSubmit: (item: NewItem) => void;
}) {
  const cat = seed.catalogId ? CATALOG_BY_ID[seed.catalogId] : undefined;
  const product = seed.product;
  const guide = useMemo(
    () =>
      profileFor({
        catalogId: cat?.id ?? null,
        slots: [],
        foodTiming: cat?.foodTiming ?? "with",
      } as unknown as StackItem),
    [cat],
  );
  const timesPerDay = product?.labelTimesPerDay ?? 1;
  const defaultSlots = (() => {
    const pool = guide.timing.best.filter((s) => !guide.timing.avoid.includes(s));
    const picked = pool.slice(0, timesPerDay);
    return picked.length ? picked : cat ? [...cat.preferredSlots] : (["breakfast"] as SlotId[]);
  })();

  const [name, setName] = useState(seed.name ?? cat?.name ?? "");
  const [units, setUnits] = useState(product?.labelServing ?? 1);
  const [amount, setAmount] = useState<number | undefined>(seed.amount ?? cat?.defaultAmount);
  const [unit, setUnit] = useState(seed.unit ?? cat?.unit ?? "mg");
  const [slots, setSlots] = useState<SlotId[]>(defaultSlots);
  const [food, setFood] = useState<FoodTiming[]>(
    guide.timing.food.length ? guide.timing.food : ["with"],
  );
  const [count, setCount] = useState<number | undefined>(seed.count ?? product?.counts[0] ?? 60);
  const [fullChoice, setFull] = useState<boolean | null>(null);
  const [leftTyped, setLeft] = useState<number | undefined>(undefined);
  const [startedAt, setStartedAt] = useState(today);
  const [consistency, setConsistency] = useState<Consistency>("most");
  const [planned, setPlanned] = useState(false);
  const [editTimeline, setEditTimeline] = useState(!cat);
  const [timeline, setTimeline] = useState<TimelineValue>({
    firstSignsDay: guide.firstSignsDay,
    typicalDay: guide.typicalDay,
    minDaysBeforeIncrease: guide.minDaysBeforeIncrease,
    evaluateDay: guide.evaluateDay,
  });
  const [rules, setRules] = useState<HabitRule[]>(
    cat ? guide.rules : [{ kind: "needs-food", text: "Take with food" }],
  );
  const [missed, setMissed] = useState<MissedMode>(guide.missed);

  const Icon = iconFor(cat?.id);
  const itemProduct: ItemProduct | undefined = product
    ? {
        id: product.id,
        brand: product.brand,
        name: product.name,
        form: product.form,
        perUnit: product.perUnit,
        dosePerUnit: product.dosePerUnit,
        labelServing: product.labelServing,
        labelUse: product.labelUse,
      }
    : undefined;
  const perDay = units * slots.length;
  // Started in the past? Estimate what's left from days × pills × how consistent you were.
  const pastDays = startedAt < today ? daysBetween(startedAt, today) : 0;
  const used = Math.round(
    pastDays *
      (product ? perDay : slots.length) *
      (consistency === "every" ? 1 : consistency === "most" ? 6 / 7 : 3 / 7),
  );
  const estimate = Math.max(0, (count ?? 0) - used);
  const full = fullChoice ?? pastDays === 0;
  const left = leftTyped ?? estimate;
  const overLabel = product && perDay > product.labelServing * product.labelTimesPerDay;
  const daily = product ? product.dosePerUnit * perDay : (amount ?? 0) * slots.length;
  const overMax = guide.maxDaily !== undefined && daily > guide.maxDaily;

  function submit() {
    const overrides: ItemOverrides = {};
    if (!cat) Object.assign(overrides, timeline, { rules, missed });
    else {
      if (timeline.firstSignsDay !== guide.firstSignsDay)
        overrides.firstSignsDay = timeline.firstSignsDay;
      if (timeline.typicalDay !== guide.typicalDay) overrides.typicalDay = timeline.typicalDay;
      if (timeline.minDaysBeforeIncrease !== guide.minDaysBeforeIncrease)
        overrides.minDaysBeforeIncrease = timeline.minDaysBeforeIncrease;
      if (timeline.evaluateDay !== guide.evaluateDay) overrides.evaluateDay = timeline.evaluateDay;
    }
    onSubmit({
      catalogId: cat?.id ?? null,
      name: name.trim() || cat?.name,
      amount: product ? undefined : (amount ?? 1),
      unit,
      units,
      product: itemProduct,
      foodTiming:
        food.includes("with") && !food.includes("empty")
          ? "with"
          : food.includes("empty") && !food.includes("with")
            ? "empty"
            : "any",
      slots,
      startedAt: planned ? today : startedAt,
      planned,
      backfill: !planned && startedAt < today ? consistency : undefined,
      servingsPerContainer: count,
      remaining: full ? undefined : left,
      servingLabel: product ? contentsLabel(product.perUnit, 1, product.form) : undefined,
      overrides: Object.keys(overrides).length ? overrides : undefined,
      source:
        seed.source ??
        (product
          ? {
              brand: product.brand,
              title: product.name,
              url: product.iherbId ? `https://www.iherb.com/pr/p/${product.iherbId}` : undefined,
            }
          : undefined),
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        {product ? (
          <BrandBadge brand={product.brand} className="size-12" />
        ) : (
          <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <Icon className="size-6" />
          </span>
        )}
        <div className="min-w-0">
          <p className="font-display text-xl leading-tight tracking-tight">
            {product?.name ?? (cat?.name || "Your supplement")}
          </p>
          {product && <p className="text-sm text-muted-foreground">{product.brand}</p>}
          {product && (
            <p className="mt-1 text-xs text-muted-foreground">Label: {product.labelUse}</p>
          )}
          {product && pillTooStrong(cat?.id ?? null, product.dosePerUnit) && (
            <p className="mt-2 rounded-lg bg-warn/15 px-2 py-1.5 text-xs text-warn">
              {pillTooStrong(cat?.id ?? null, product.dosePerUnit)}
            </p>
          )}
        </div>
      </div>

      <Section title="Dose">
        {!cat && (
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. PQQ" />
          </Field>
        )}
        {product ? (
          <>
            <Stepper
              value={units}
              onChange={setUnits}
              label={`${unitWord(product.form, units)} per dose`}
            />
            <p className="rounded-xl bg-secondary px-3 py-2 text-sm">
              {contentsLabel(product.perUnit, units, product.form)}
            </p>
          </>
        ) : (
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Field label="Amount per dose">
              <NumberInput value={amount} onChange={setAmount} />
            </Field>
            <Field label="Unit">
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
            </Field>
          </div>
        )}
        {overMax && (
          <p className="text-xs text-warn">
            That's {Math.round(daily)} {unit} a day, above the usual ceiling ({guide.ceiling}).
          </p>
        )}
        {!overMax && overLabel && (
          <p className="text-xs text-warn">That's more than the label suggests per day.</p>
        )}
      </Section>

      <Section title="Already taking it?">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Not started yet — it's in my cabinet</p>
            <p className="text-xs text-muted-foreground">
              No reminders. Supplime suggests when to start it.
            </p>
          </div>
          <Switch checked={planned} onCheckedChange={setPlanned} />
        </div>
        {!planned && (
          <>
            <StartedPicker value={startedAt} onChange={setStartedAt} today={today} />
            {startedAt < today && (
              <Field
                label="Since then you took it…"
                hint="This rebuilds your history so the timeline and consistency are honest."
              >
                <ConsistencyPicker value={consistency} onChange={setConsistency} />
              </Field>
            )}
          </>
        )}
      </Section>

      <Section
        title="When"
        hint={
          product && product.labelTimesPerDay > 1
            ? `The label suggests ${product.labelTimesPerDay} times a day.`
            : undefined
        }
      >
        <SlotHintPicker
          value={slots}
          onChange={setSlots}
          times={times}
          best={guide.timing.best}
          avoid={guide.timing.avoid}
        />
        <Field label="Food — pick every option that's fine">
          <FoodOkPicker
            value={food}
            onChange={setFood}
            allowed={cat ? guide.timing.food : undefined}
          />
        </Field>
        {cat && <p className="text-xs text-muted-foreground">{cat.foodWhy}</p>}
      </Section>

      <Section title="Bottle">
        {product && product.counts.length > 1 ? (
          <div className="flex flex-wrap gap-2">
            {product.counts.map((c) => (
              <Chip key={c} on={count === c} onClick={() => setCount(c)}>
                {c} {product.form === "scoop" ? "servings" : unitWord(product.form, c)}
              </Chip>
            ))}
          </div>
        ) : (
          <Field
            label={product ? `${unitWord(product.form, 2)} in the bottle` : "Pills in the bottle"}
          >
            <NumberInput value={count} step={1} onChange={setCount} />
          </Field>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Chip on={full} onClick={() => setFull(true)}>
            New / full
          </Chip>
          <Chip on={!full} onClick={() => setFull(false)}>
            Already opened
          </Chip>
          {!full && (
            <span className="flex items-center gap-2 text-sm">
              <NumberInput
                className="w-20"
                step={1}
                value={left}
                onChange={setLeft}
                placeholder="left"
              />{" "}
              left
            </span>
          )}
        </div>
        {!full && pastDays > 0 && leftTyped === undefined && (
          <p className="text-xs text-muted-foreground">
            Estimated from {pastDays} days since {startedAt.slice(5)}. Count the bottle and correct
            it if you like.
          </p>
        )}
      </Section>

      <Section
        title="How long it takes"
        hint={cat ? undefined : "Rough is fine — you can refine it later."}
      >
        {!editTimeline ? (
          <div className="space-y-2 text-sm">
            <p>
              {guide.kind === "acute" && guide.minutes
                ? `Felt within ${guide.minutes.min}–${guide.minutes.max} min of a dose.`
                : `First signs from day ${timeline.firstSignsDay}; most people feel it by day ${timeline.typicalDay}.`}{" "}
              Dose changes unlock after {timeline.minDaysBeforeIncrease} days; verdict on day{" "}
              {timeline.evaluateDay}.
            </p>
            <button
              type="button"
              className="text-xs underline"
              onClick={() => setEditTimeline(true)}
            >
              Adjust these numbers
            </button>
          </div>
        ) : (
          <TimelineFields value={timeline} onChange={setTimeline} />
        )}
      </Section>

      {!cat && (
        <Section title="Habits & rules">
          <RulesEditor value={rules} onChange={setRules} />
          <Field label="If you miss a dose">
            <MissedPicker value={missed} onChange={setMissed} />
          </Field>
        </Section>
      )}

      <Button className={cn("w-full")} size="lg" disabled={!cat && !name.trim()} onClick={submit}>
        {submitLabel}
      </Button>
    </div>
  );
}
