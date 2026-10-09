import { fitCheck, slotNames, usesFor } from "@/lib/advisor";
import { appToday, useSupplime } from "@/lib/store";
import {
  Activity,
  Atom,
  Bone,
  Brain,
  ChevronRight,
  Droplet,
  Dumbbell,
  Fish,
  Flame,
  Flower2,
  Gem,
  HeartPulse,
  Leaf,
  Moon,
  Pill,
  Shield,
  Sprout,
  Sun,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { CATALOG, searchCatalog } from "@/lib/catalog";
import { EXTRA, profileFor } from "@/lib/knowledge";
import { pillTooStrong } from "@/lib/knowledge";
import { brandsFor, contentsLabel, productsFor, type Product } from "@/lib/products";
import type { CatalogItem, StackItem } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICON: Record<string, LucideIcon> = {
  "lions-mane": Brain,
  "l-theanine": Leaf,
  melatonin: Moon,
  "omega-3": Fish,
  magnesium: Gem,
  "vitamin-d": Sun,
  "vitamin-k2": Bone,
  ashwagandha: Sprout,
  rhodiola: Zap,
  bacopa: Brain,
  creatine: Dumbbell,
  zinc: Shield,
  "vitamin-c": Shield,
  "vitamin-b12": Zap,
  glycine: Moon,
  curcumin: Flame,
  coq10: HeartPulse,
  probiotic: Sprout,
  iron: Droplet,
  collagen: Bone,
  electrolytes: Droplet,
  reishi: Flower2,
  cordyceps: Activity,
  "alpha-gpc": Atom,
  berberine: Leaf,
  taurine: Atom,
  saffron: Flower2,
  apigenin: Moon,
  nac: Atom,
  "b-complex": Zap,
};

export function iconFor(catalogId: string | null | undefined): LucideIcon {
  return (catalogId && ICON[catalogId]) || Pill;
}

/** Popular first; the rest alphabetically. */
const POPULAR = [
  "lions-mane",
  "l-theanine",
  "melatonin",
  "omega-3",
  "magnesium",
  "vitamin-d",
  "ashwagandha",
  "creatine",
  "zinc",
  "probiotic",
];

export type Picked = {
  catalogId?: string;
  product?: Product;
  custom?: boolean;
  /** You picked a new bottle for something you already have. */
  switchFor?: string;
};

/**
 * Pick a supplement the way you'd find it on a shelf: the type first, then the brand,
 * then the exact bottle. Every step can be skipped ("another brand", "my own").
 */
export function ProductPicker({
  onPick,
  owned = [],
  exclude: blocked = [],
}: {
  onPick: (p: Picked) => void;
  /** What's already in your cabinet. */
  owned?: StackItem[];
  /** Types you can't pick again (e.g. already chosen during onboarding). */
  exclude?: string[];
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<CatalogItem | null>(null);
  // Read about it first, then choose a bottle.
  const [reading, setReading] = useState(true);
  const [brand, setBrand] = useState<string | null>(null);
  const [switchFor, setSwitchFor] = useState<string | undefined>(undefined);
  const exclude = owned.filter((i) => !i.archived && i.catalogId).map((i) => i.catalogId!);
  const pick = (p: Picked) => onPick({ ...p, switchFor });

  const types = useMemo(() => {
    const list = query.trim()
      ? searchCatalog(query)
      : [...CATALOG].sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
    return list;
  }, [query]);

  if (type && reading) {
    const have = owned.find((i) => i.catalogId === type.id && !i.archived);
    return (
      <TypeInfo
        item={type}
        have={have}
        onBack={() => setType(null)}
        onChoose={(asSwitch) => {
          setSwitchFor(asSwitch ? have?.id : undefined);
          if (brandsFor(type.id).length) setReading(false);
          else onPick({ catalogId: type.id, switchFor: asSwitch ? have?.id : undefined });
        }}
      />
    );
  }

  if (type && !brand) {
    const brands = brandsFor(type.id);
    return (
      <div className="space-y-3">
        <Back onClick={() => setReading(true)} label={`About ${type.name}`} />
        <TypeHeader item={type} />
        <p className="text-sm font-medium">Which brand?</p>
        <div className="grid gap-2">
          {brands.map((b) => (
            <Row
              key={b}
              title={b}
              detail={`${productsFor(type.id).filter((p) => p.brand === b).length} product${productsFor(type.id).filter((p) => p.brand === b).length === 1 ? "" : "s"}`}
              onClick={() => setBrand(b)}
            >
              <BrandBadge brand={b} />
            </Row>
          ))}
          <Row
            title="Another brand"
            detail="Enter the strength from your label"
            onClick={() => pick({ catalogId: type.id })}
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-muted-foreground">
              <Pill className="size-5" />
            </span>
          </Row>
        </div>
      </div>
    );
  }

  if (type && brand) {
    const products = productsFor(type.id).filter((p) => p.brand === brand);
    return (
      <div className="space-y-3">
        <Back onClick={() => setBrand(null)} label={type.name} />
        <div className="flex items-center gap-3">
          <BrandBadge brand={brand} />
          <p className="font-display text-xl tracking-tight">{brand}</p>
        </div>
        <div className="grid gap-2">
          {products.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => pick({ catalogId: type.id, product: p })}
              className="rounded-2xl bg-card p-4 text-left shadow-[var(--shadow-border)]"
            >
              <p className="font-medium">{p.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {contentsLabel(p.perUnit, 1, p.form)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {p.counts.join(" / ")} {p.form === "scoop" ? "servings" : "per bottle"} · label:{" "}
                {p.labelUse}
              </p>
              {pillTooStrong(type.id, p.dosePerUnit) && (
                <p className="mt-1.5 rounded-lg bg-warn/15 px-2 py-1 text-xs text-warn">
                  Strong: one pill is over the usual daily maximum.
                </p>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search: Lion's Mane, fish oil, sleep…"
      />
      <div className="grid grid-cols-2 gap-2">
        {types.map((t) => {
          const Icon = iconFor(t.id);
          const p = profileFor({
            catalogId: t.id,
            slots: [],
            foodTiming: t.foodTiming,
          } as unknown as StackItem);
          const taken = exclude.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              disabled={blocked.includes(t.id)}
              onClick={() => {
                setType(t);
                setReading(true);
                setBrand(null);
              }}
              className={cn(
                "flex flex-col items-start gap-2 rounded-2xl bg-card p-3 text-left shadow-[var(--shadow-border)]",
                taken && "ring-1 ring-primary/30",
                "disabled:opacity-45",
              )}
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="size-5" />
              </span>
              <span className="text-sm leading-tight font-medium">{t.name}</span>
              <UseTags catalogId={t.id} />
              <span className="text-[11px] leading-tight text-muted-foreground">
                {taken
                  ? "In your cabinet"
                  : p.kind === "acute" && p.minutes
                    ? `Felt in ${p.minutes.min}–${p.minutes.max} min`
                    : `~day ${p.typicalDay} to feel`}
              </span>
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="w-full rounded-2xl bg-secondary px-4 py-3 text-left text-sm"
        onClick={() => onPick({ custom: true })}
      >
        <span className="font-medium">Not in the list?</span> Create your own
      </button>
    </div>
  );
}

/** Read first: what it is, how it's taken, what to watch for, and how it fits your cabinet. */
function TypeInfo({
  item,
  have,
  onBack,
  onChoose,
}: {
  item: CatalogItem;
  have?: StackItem;
  onBack: () => void;
  onChoose: (asSwitch: boolean) => void;
}) {
  const stack = useSupplime((s) => s.stack);
  const today = appToday();
  const p = profileFor({
    catalogId: item.id,
    slots: [],
    foodTiming: item.foodTiming,
  } as unknown as StackItem);
  const notes = fitCheck(item.id, { stack, today, excludeId: have?.id });
  return (
    <div className="space-y-3">
      <Back onClick={onBack} label="All types" />
      <TypeHeader item={item} />
      <UseTags catalogId={item.id} />
      <div className="grid grid-cols-2 gap-2 text-sm">
        <Fact label="Typical dose" value={item.typicalDose} />
        <Fact
          label="When you'll feel it"
          value={
            p.kind === "acute" && p.minutes
              ? `${p.minutes.min}–${p.minutes.max} min after a dose`
              : `around day ${p.typicalDay} (${p.firstSignsDay}–${p.windowEndDay})`
          }
        />
        <Fact label="Best time" value={slotNames(p.timing.best)} />
        <Fact
          label="Food"
          value={
            p.timing.food.includes("any") ||
            (p.timing.food.includes("with") && p.timing.food.includes("empty"))
              ? "With or without"
              : p.timing.food.includes("with")
                ? "With food"
                : "Empty stomach"
          }
        />
      </div>
      {p.watch.length > 0 && (
        <p className="text-sm">
          <span className="font-medium">Watch for:</span> {p.watch.slice(0, 4).join(", ")}.
        </p>
      )}
      {notes.length > 0 && (
        <div className="space-y-1.5 rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
          <p className="text-sm font-medium">With your cabinet</p>
          {notes.map((n) => (
            <p
              key={n.text}
              className={cn(
                "text-sm",
                n.tone === "warn"
                  ? "text-warn"
                  : n.tone === "good"
                    ? "text-primary"
                    : "text-muted-foreground",
              )}
            >
              {n.tone === "good" ? "✓ " : n.tone === "warn" ? "! " : "· "}
              {n.text}
            </p>
          ))}
        </div>
      )}
      {have ? (
        <div className="grid gap-2">
          <p className="text-sm text-muted-foreground">
            You have {have.name}
            {have.product ? ` (${have.product.brand} ${have.product.name})` : ""}.
          </p>
          <button
            type="button"
            onClick={() => onChoose(true)}
            className="rounded-xl bg-primary px-4 py-3 text-left text-primary-foreground"
          >
            <span className="block font-medium">Switch to a different bottle</span>
            <span className="block text-xs opacity-80">Keeps your history and timeline.</span>
          </button>
          <button
            type="button"
            onClick={() => onChoose(false)}
            className="rounded-xl bg-secondary px-4 py-3 text-left"
          >
            <span className="block font-medium">Add a second one anyway</span>
            <span className="block text-xs text-muted-foreground">
              Rarely needed: tracked separately.
            </span>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onChoose(false)}
          className="w-full rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground"
        >
          Choose a bottle
        </button>
      )}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm leading-snug">{value}</p>
    </div>
  );
}

function rank(id: string) {
  const i = POPULAR.indexOf(id);
  return i === -1 ? 100 : i;
}

function TypeHeader({ item }: { item: CatalogItem }) {
  const Icon = iconFor(item.id);
  const x = EXTRA[item.id];
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground">
        <Icon className="size-6" />
      </span>
      <div>
        <p className="font-display text-xl tracking-tight">{item.name}</p>
        <p className="text-sm text-muted-foreground">{item.summary}</p>
        {x && (
          <p className="mt-1 text-xs text-primary">
            {x.evidence === "strong" ? "Strong" : x.evidence === "moderate" ? "Moderate" : "Early"}{" "}
            evidence · typical {item.typicalDose}
          </p>
        )}
      </div>
    </div>
  );
}

function Row({
  title,
  detail,
  onClick,
  children,
}: {
  title: string;
  detail: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 rounded-2xl bg-card p-3 text-left shadow-[var(--shadow-border)]"
    >
      {children}
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
      <ChevronRight className="size-5 text-muted-foreground" />
    </button>
  );
}

function Back({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="min-h-9 text-sm text-muted-foreground">
      ← {label}
    </button>
  );
}

/** A simple coloured monogram per brand (no logos or product photos are bundled). */
const BRAND_COLOR: Record<string, string> = {
  "California Gold Nutrition": "bg-[#7a1f1f] text-[#f3d27a]",
  "NOW Foods": "bg-[#e05a2b] text-white",
  "Doctor's Best": "bg-[#f07d22] text-white",
  "Life Extension": "bg-[#00205b] text-white",
  "Sports Research": "bg-[#1d1d1d] text-white",
  "Nordic Naturals": "bg-[#0a4f8a] text-white",
  "Host Defense": "bg-[#3b5e2b] text-white",
  "Real Mushrooms": "bg-[#6b4b2a] text-white",
  Natrol: "bg-[#5b2a86] text-white",
  Swanson: "bg-[#0b5394] text-white",
  "Jarrow Formulas": "bg-[#c8102e] text-white",
  Thorne: "bg-[#2b2b2b] text-white",
  Solgar: "bg-[#8b6f2f] text-white",
};

/** Small labels: what people usually take it for. */
export function UseTags({
  catalogId,
  className,
}: {
  catalogId: string | null;
  className?: string;
}) {
  const uses = usesFor(catalogId).slice(0, 3);
  if (!uses.length) return null;
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {uses.map((u) => (
        <span
          key={u}
          className="rounded-full bg-accent/70 px-1.5 py-0.5 text-[10px] leading-none font-medium text-accent-foreground"
        >
          {u}
        </span>
      ))}
    </span>
  );
}

export function BrandBadge({ brand, className }: { brand: string; className?: string }) {
  const initials = brand
    .replace(/'s\b/g, "")
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold",
        BRAND_COLOR[brand] ?? "bg-secondary text-foreground",
        className,
      )}
    >
      {initials}
    </span>
  );
}
