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

export type Picked = { catalogId?: string; product?: Product; custom?: boolean };

/**
 * Pick a supplement the way you'd find it on a shelf: the type first, then the brand,
 * then the exact bottle. Every step can be skipped ("another brand", "my own").
 */
export function ProductPicker({
  onPick,
  exclude = [],
}: {
  onPick: (p: Picked) => void;
  exclude?: string[];
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<CatalogItem | null>(null);
  const [brand, setBrand] = useState<string | null>(null);

  const types = useMemo(() => {
    const list = query.trim()
      ? searchCatalog(query)
      : [...CATALOG].sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
    return list;
  }, [query]);

  if (type && !brand) {
    const brands = brandsFor(type.id);
    return (
      <div className="space-y-3">
        <Back onClick={() => setType(null)} label="All types" />
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
            onClick={() => onPick({ catalogId: type.id })}
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
              onClick={() => onPick({ catalogId: type.id, product: p })}
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
              disabled={taken}
              onClick={() => (brandsFor(t.id).length ? setType(t) : onPick({ catalogId: t.id }))}
              className="flex flex-col items-start gap-2 rounded-2xl bg-card p-3 text-left shadow-[var(--shadow-border)] disabled:opacity-45"
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="size-5" />
              </span>
              <span className="text-sm leading-tight font-medium">{t.name}</span>
              <span className="text-[11px] leading-tight text-muted-foreground">
                {taken
                  ? "Already added"
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
