import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Field,
  FoodPicker,
  MissedPicker,
  NumberInput,
  RulesEditor,
  Section,
  SlotPicker,
  StartedPicker,
  TimelineFields,
  type TimelineValue,
} from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Screen } from "@/components/ui/screen";
import { Textarea } from "@/components/ui/textarea";
import { CATALOG_BY_ID, searchCatalog } from "@/lib/catalog";
import { parseProduct, type ParsedProduct } from "@/lib/iherb";
import { profileFor } from "@/lib/knowledge";
import { useNav } from "@/lib/nav";
import { appToday, useSupplime } from "@/lib/store";
import type {
  FoodTiming,
  HabitRule,
  ItemOverrides,
  MissedMode,
  SlotId,
  StackItem,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "guide" | "iherb" | "custom";

type Seed = {
  catalogId?: string;
  name?: string;
  amount?: number;
  unit?: string;
  count?: number;
  servingLabel?: string;
  source?: StackItem["source"];
};

/** Add a supplement: from the guide, from an iHerb link or share, or your own. */
export function AddScreen({ text }: { text?: string }) {
  const close = useNav((s) => s.close);
  const [mode, setMode] = useState<Mode>(text ? "iherb" : "guide");
  const [seed, setSeed] = useState<Seed | null>(null);

  if (seed) {
    return <NewItemForm seed={seed} onBack={() => setSeed(null)} onDone={close} />;
  }

  return (
    <Screen onClose={close} title="Add a supplement">
      <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl bg-secondary p-1">
        {(
          [
            ["guide", "Guide"],
            ["iherb", "iHerb link"],
            ["custom", "My own"],
          ] as const
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "h-10 rounded-lg text-sm font-medium",
              mode === m ? "bg-card shadow-sm" : "text-muted-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {mode === "guide" && <GuideSearch onPick={(catalogId) => setSeed({ catalogId })} />}
      {mode === "iherb" && (
        <IherbPaste initial={text} onPick={(p) => setSeed(seedFromProduct(p))} />
      )}
      {mode === "custom" && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Anything the guide doesn't know. You set how long it should take to work, and Supplime
            tracks it the same way.
          </p>
          <Button className="w-full" onClick={() => setSeed({})}>
            Create my own
          </Button>
        </div>
      )}
    </Screen>
  );
}

function seedFromProduct(p: ParsedProduct): Seed {
  const cat = p.catalogId ? CATALOG_BY_ID[p.catalogId] : undefined;
  const unitMatches = !cat || !p.unit || cat.unit.toLowerCase() === p.unit.toLowerCase();
  return {
    catalogId: p.catalogId,
    name: cat ? cat.name : p.name,
    amount: unitMatches ? p.amount : undefined,
    unit: unitMatches ? p.unit : undefined,
    count: p.count,
    servingLabel:
      p.amount && p.unit ? `1 ${singular(p.form ?? "serving")} = ${p.amount} ${p.unit}` : undefined,
    source: { url: p.url, brand: p.brand, title: p.title },
  };
}

function singular(form: string) {
  return form.replace(/s$/, "").replace(/^veg(gie|etarian)? /, "veg ");
}

function GuideSearch({ onPick }: { onPick: (catalogId: string) => void }) {
  const stack = useSupplime((s) => s.stack);
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchCatalog(query), [query]);
  const have = new Set(stack.filter((s) => !s.archived).map((s) => s.catalogId));
  return (
    <div>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Lion's Mane, magnesium, theanine…"
        autoFocus
      />
      <div className="mt-3 space-y-2">
        {results.map((item) => {
          const p = profileFor({ catalogId: item.id } as StackItem);
          const already = have.has(item.id);
          return (
            <button
              key={item.id}
              type="button"
              disabled={already}
              onClick={() => onPick(item.id)}
              className="w-full rounded-xl bg-card px-4 py-3 text-left shadow-[var(--shadow-border)] disabled:opacity-50"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{item.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {already ? "In your stack" : item.typicalDose}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.summary}</p>
              <p className="mt-1.5 text-xs font-medium text-primary">
                {p.kind === "acute" && p.minutes
                  ? `Felt in ${p.minutes.min}–${p.minutes.max} min · verdict after ${p.evaluateDay} days`
                  : `Usually felt around day ${p.typicalDay} · verdict after ${p.evaluateDay} days`}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function IherbPaste({ initial, onPick }: { initial?: string; onPick: (p: ParsedProduct) => void }) {
  const [text, setText] = useState(initial ?? "");
  const parsed = useMemo(() => parseProduct(text), [text]);
  const cat = parsed?.catalogId ? CATALOG_BY_ID[parsed.catalogId] : undefined;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        In the iHerb app, open the product and tap{" "}
        <span className="font-medium text-foreground">Share → Supplime</span>. Or copy the product
        link or title and paste it here.
      </p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="https://www.iherb.com/pr/now-foods-l-theanine-200-mg-120-veg-capsules/…"
        className="min-h-28"
      />
      {text.trim() && !parsed && (
        <p className="text-sm text-warn">
          Couldn't read a product from that. Try the full product link or title.
        </p>
      )}
      {parsed && (
        <div className="space-y-2 rounded-xl bg-card p-4 shadow-[var(--shadow-border)]">
          {parsed.brand && (
            <p className="text-xs tracking-wide text-muted-foreground uppercase">{parsed.brand}</p>
          )}
          <p className="font-medium">{parsed.name}</p>
          <p className="text-sm text-muted-foreground">
            {[
              parsed.amount && `${parsed.amount} ${parsed.unit}`,
              parsed.count && `${parsed.count} ${parsed.form ?? ""}`,
            ]
              .filter(Boolean)
              .join(" · ") || "No dose found — you can enter it next."}
          </p>
          <p className="text-sm">
            {cat ? (
              <>
                Matched the guide: <span className="font-medium">{cat.name}</span> — timeline and
                rules included.
              </>
            ) : (
              "Not in the guide yet — you'll set how long it takes."
            )}
          </p>
          <Button className="mt-2 w-full" onClick={() => onPick(parsed)}>
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}

/** The last step for every way of adding: dose, since when, windows, timeline. */
function NewItemForm({
  seed,
  onBack,
  onDone,
}: {
  seed: Seed;
  onBack: () => void;
  onDone: () => void;
}) {
  const profile = useSupplime((s) => s.profile);
  const addItem = useSupplime((s) => s.addItem);
  const today = appToday();
  const cat = seed.catalogId ? CATALOG_BY_ID[seed.catalogId] : undefined;
  const guide = profileFor({
    catalogId: seed.catalogId ?? null,
    foodTiming: cat?.foodTiming ?? "any",
  } as StackItem);

  const [name, setName] = useState(seed.name ?? cat?.name ?? "");
  const [amount, setAmount] = useState<number | undefined>(seed.amount ?? cat?.defaultAmount);
  const [unit, setUnit] = useState(seed.unit ?? cat?.unit ?? "mg");
  const [startedAt, setStartedAt] = useState(today);
  const [slots, setSlots] = useState<SlotId[]>(cat ? [...cat.preferredSlots] : ["breakfast"]);
  const [food, setFood] = useState<FoodTiming>(cat?.foodTiming ?? "with");
  const [count, setCount] = useState<number | undefined>(seed.count ?? 60);
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

  function add() {
    const overrides: ItemOverrides = {};
    if (!cat) {
      Object.assign(overrides, timeline, { rules, missed });
    } else {
      if (timeline.firstSignsDay !== guide.firstSignsDay)
        overrides.firstSignsDay = timeline.firstSignsDay;
      if (timeline.typicalDay !== guide.typicalDay) overrides.typicalDay = timeline.typicalDay;
      if (timeline.minDaysBeforeIncrease !== guide.minDaysBeforeIncrease)
        overrides.minDaysBeforeIncrease = timeline.minDaysBeforeIncrease;
      if (timeline.evaluateDay !== guide.evaluateDay) overrides.evaluateDay = timeline.evaluateDay;
    }
    const id = addItem({
      catalogId: seed.catalogId ?? null,
      name,
      amount: amount ?? 1,
      unit,
      foodTiming: food,
      slots,
      startedAt,
      servingsPerContainer: count,
      servingLabel: seed.servingLabel,
      source: seed.source,
      overrides: Object.keys(overrides).length ? overrides : undefined,
    });
    if (!id) {
      toast.error("Give it a name first.");
      return;
    }
    const day = Math.round((Date.parse(today) - Date.parse(startedAt)) / 86_400_000) + 1;
    toast(`Added ${name}`, {
      description:
        day > 1
          ? `Picking up on day ${day} of its journey.`
          : `Day 1. Most people notice it around day ${timeline.typicalDay}.`,
    });
    onDone();
  }

  return (
    <Screen
      onClose={onBack}
      title={cat?.name ?? (name || "Your supplement")}
      subtitle={seed.source?.brand}
      footer={
        <Button className="w-full" disabled={!name.trim()} onClick={add}>
          Add to my stack
        </Button>
      }
    >
      <div className="space-y-4">
        {cat && <p className="text-sm text-muted-foreground">{cat.summary}</p>}
        <Section title="Dose">
          {!cat && (
            <Field label="Name">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. PQQ"
              />
            </Field>
          )}
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            <Field label="Amount per dose">
              <NumberInput value={amount} onChange={setAmount} />
            </Field>
            <Field label="Unit">
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
            </Field>
          </div>
          {cat && <p className="text-xs text-muted-foreground">Typical: {cat.typicalDose}.</p>}
          <Field label="Capsules in the bottle">
            <NumberInput value={count} step={1} onChange={setCount} />
          </Field>
        </Section>

        <Section
          title="Already taking it?"
          hint="Pick when you started so the timeline starts on the right day."
        >
          <StartedPicker value={startedAt} onChange={setStartedAt} today={today} />
        </Section>

        <Section title="When">
          <SlotPicker value={slots} onChange={setSlots} times={profile.slotTimes} />
          <Field label="Food">
            <FoodPicker value={food} onChange={setFood} />
          </Field>
        </Section>

        <Section
          title="How long it takes"
          hint={cat ? `From the guide. ${guide.note}` : "Rough is fine — you can refine it later."}
        >
          <TimelineFields value={timeline} onChange={setTimeline} />
        </Section>

        {!cat && (
          <Section title="Habits & rules">
            <RulesEditor value={rules} onChange={setRules} />
            <Field label="If you miss a dose">
              <MissedPicker value={missed} onChange={setMissed} />
            </Field>
          </Section>
        )}
      </div>
    </Screen>
  );
}
