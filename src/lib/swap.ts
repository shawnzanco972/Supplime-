import { nextStep, pillTooStrong, profileFor, unitStrength } from "./knowledge";
import { productsFor, type Product } from "./products";
import type { StackItem } from "./types";
import { addDays } from "./utils";

export type Swap = {
  direction: 1 | -1;
  product: Product;
  /** Pills of the new bottle per dose. */
  units: number;
  /** New dose per time of day. */
  amount: number;
  why: string;
};

/**
 * When your capsule can't make a safe step (one more pill would cross the per-dose or
 * daily limit, or one pill is already the smallest you can take), find a bottle with a
 * different strength that can. Never more than +100% per step, never past a limit.
 */
export function capsuleSwap(item: StackItem, direction: 1 | -1): Swap | null {
  if (!item.catalogId) return null;
  const p = profileFor(item);
  if (direction === 1 && p.noStepUp) return null;
  const strength = unitStrength(item).amount;
  const perDay = Math.max(1, item.slots.length);
  if (direction === 1 && nextStep(item, 1) !== null) return null;
  if (direction === -1) {
    const down = nextStep(item, -1);
    if (down === null) return null;
    const ratio = down / strength;
    if (Math.abs(ratio - Math.round(ratio)) < 0.01 && ratio >= 1) return null;
  }
  const ok = (amount: number) =>
    (p.maxDaily === undefined || amount * perDay <= p.maxDaily + 1e-9) &&
    (p.perDoseMax === undefined || amount <= p.perDoseMax + 1e-9);
  const candidates: Swap[] = [];
  for (const product of productsFor(item.catalogId)) {
    if (product.id === item.product?.id) continue;
    if (Math.abs(product.dosePerUnit - strength) < 1e-9) continue;
    if (pillTooStrong(item.catalogId, product.dosePerUnit)) continue;
    for (let units = 1; units <= 3; units++) {
      const amount = Math.round(units * product.dosePerUnit * 1000) / 1000;
      if (!ok(amount)) continue;
      if (direction === 1 && (amount <= item.amount + 1e-9 || amount > item.amount * 2 + 1e-9))
        continue;
      // A step down should be a real drop (at least a quarter less).
      if (direction === -1 && amount > item.amount * 0.75 + 1e-9) continue;
      candidates.push({ direction, product, units, amount, why: "" });
    }
  }
  if (!candidates.length) return null;
  candidates.sort((a, b) =>
    direction === 1
      ? a.amount - b.amount || a.units - b.units
      : a.units - b.units || b.amount - a.amount,
  );
  const best = candidates[0]!;
  const daily = perDay > 1 ? ` (${round(best.amount * perDay)} ${item.unit} a day)` : "";
  best.why =
    direction === 1
      ? `Another ${round(strength)} ${item.unit} pill would go over the safe limit, so step up with ${best.product.brand} ${best.product.name}: ${best.units} per dose = ${round(best.amount)} ${item.unit}${daily}.`
      : `Your pills can't go lower than one, so switch to ${best.product.brand} ${best.product.name}: ${best.units} per dose = ${round(best.amount)} ${item.unit}${daily}.`;
  return best;
}

/** Order the new bottle so it arrives before the dose review. */
export function orderByDate(reviewOn: string, today: string, leadDays: number) {
  const by = addDays(reviewOn, -leadDays);
  return by > today ? by : today;
}

export function iherbUrl(product: Product) {
  return product.iherbId
    ? `https://www.iherb.com/pr/p/${product.iherbId}`
    : `https://www.iherb.com/search?kw=${encodeURIComponent(`${product.brand} ${product.name}`)}`;
}

const round = (n: number) => Math.round(n * 100) / 100;
