import { useState } from "react";
import { toast } from "sonner";
import { Chip, Field, NumberInput, Section, Stepper } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { doseLabel } from "@/lib/journey";
import { pillsFor, pillTooStrong } from "@/lib/knowledge";
import { contentsLabel, unitWord, type Product } from "@/lib/products";
import { daysOfStock } from "@/lib/stats";
import { appToday, useSupplime } from "@/lib/store";
import { addDays, formatShortDate } from "@/lib/utils";

/**
 * A new bottle for something you already take: pick the pills per dose (pre-set to keep your
 * dose as close as possible), and when it starts. History and timeline carry over.
 */
export function SwitchBottle({
  itemId,
  product,
  onBack,
  onDone,
}: {
  itemId: string;
  product: Product;
  onBack: () => void;
  onDone: () => void;
}) {
  const item = useSupplime((s) => s.stack.find((i) => i.id === itemId));
  const logs = useSupplime((s) => s.logs);
  const switchBottle = useSupplime((s) => s.switchBottle);
  const today = appToday();
  const [units, setUnits] = useState(() =>
    item ? Math.max(1, Math.round(item.amount / product.dosePerUnit)) : 1,
  );
  const [count, setCount] = useState<number | undefined>(product.counts[0]);
  const takenToday = logs.some(
    (l) => l.itemId === itemId && l.date === today && l.status === "taken",
  );
  const runsOut = item ? addDays(today, daysOfStock(item)) : today;
  const options = [
    { id: today, label: "Today" },
    { id: addDays(today, 1), label: "Tomorrow" },
    ...(runsOut > addDays(today, 1)
      ? [{ id: runsOut, label: `When the old one runs out (${formatShortDate(runsOut)})` }]
      : []),
  ];
  const [startOn, setStartOn] = useState(takenToday ? addDays(today, 1) : today);
  if (!item) return null;
  const amount = Math.round(units * product.dosePerUnit * 1000) / 1000;
  const same = Math.abs(amount - item.amount) < 1e-9;
  const strong = pillTooStrong(item.catalogId, product.dosePerUnit);

  return (
    <Screen
      onClose={onBack}
      title="Switch bottle"
      subtitle={`${item.name}: your history stays`}
      footer={
        <Button
          className="w-full"
          size="lg"
          onClick={() => {
            switchBottle(itemId, {
              product: {
                id: product.id,
                brand: product.brand,
                name: product.name,
                form: product.form,
                perUnit: product.perUnit,
                dosePerUnit: product.dosePerUnit,
                labelServing: product.labelServing,
                labelUse: product.labelUse,
              },
              units,
              bottle: count ?? product.counts[0] ?? 60,
              startOn,
            });
            toast(`${item.name}: ${product.brand}`, {
              description:
                startOn === today
                  ? same
                    ? "New bottle from today, same dose."
                    : `${amount} ${item.unit} from today: a new dose step.`
                  : `Starts ${formatShortDate(startOn)}. Until then, the old bottle.`,
            });
            onDone();
          }}
        >
          Switch {startOn === today ? "now" : `on ${formatShortDate(startOn)}`}
        </Button>
      }
    >
      <div className="space-y-4">
        <Section title={`${product.brand} · ${product.name}`}>
          <p className="text-sm text-muted-foreground">
            Now: {doseLabel(item, item.amount)}
            {item.product ? ` of ${item.product.brand}` : ""}.
          </p>
          <Stepper
            value={units}
            onChange={setUnits}
            label={`${unitWord(product.form, units)} per dose`}
          />
          <p className="rounded-xl bg-secondary px-3 py-2 text-sm">
            {contentsLabel(product.perUnit, units, product.form)}
          </p>
          <p className="text-sm">
            {same
              ? "Same dose as now: your timeline continues without a new step."
              : amount > item.amount
                ? `That's more than now (${item.amount} → ${amount} ${item.unit}): it starts a new dose step.`
                : `That's less than now (${item.amount} → ${amount} ${item.unit}): it starts a new dose step.`}
          </p>
          {!same && pillsFor(item) > 0 && (
            <p className="text-xs text-muted-foreground">
              Closest match to your current dose:{" "}
              {Math.max(1, Math.round(item.amount / product.dosePerUnit))}{" "}
              {unitWord(product.form, 2)}.
            </p>
          )}
          {strong && <p className="text-xs text-warn">{strong}</p>}
        </Section>
        <Section title="Start it">
          <div className="flex flex-wrap gap-2">
            {options.map((o) => (
              <Chip key={o.id} on={startOn === o.id} onClick={() => setStartOn(o.id)}>
                {o.label}
              </Chip>
            ))}
          </div>
          {takenToday && startOn === today && (
            <p className="text-xs text-muted-foreground">
              You already took today's dose from the old bottle.
            </p>
          )}
        </Section>
        <Section title="New bottle">
          <Field label={`${unitWord(product.form, 2)} in the bottle`}>
            <NumberInput value={count} step={1} onChange={setCount} />
          </Field>
        </Section>
      </div>
    </Screen>
  );
}
