/**
 * Popular iHerb products with their label facts, so adding one fills in the strength,
 * every ingredient, bottle size and label directions for you.
 *
 * Label facts were checked against product listings and supplement-facts panels in
 * October 2026. Formulas change: the app always lets you correct them.
 */

export type Form = "capsule" | "veg capsule" | "softgel" | "tablet" | "lozenge" | "scoop";

export type Ingredient = { name: string; amount: number; unit: string };

export type Product = {
  id: string;
  catalogId: string;
  brand: string;
  name: string;
  form: Form;
  /** Bottle sizes sold (pills or scoops). */
  counts: number[];
  /** What one pill contains. */
  perUnit: Ingredient[];
  /** One pill expressed in the guide's dose unit (e.g. EPA+DHA mg for fish oil). */
  dosePerUnit: number;
  /** Pills in one label serving. */
  labelServing: number;
  /** How many times a day the label suggests. */
  labelTimesPerDay: number;
  labelUse: string;
  iherbId?: number;
};

const P = (p: Product) => p;

export const PRODUCTS: Product[] = [
  // Lion's Mane
  P({
    id: "cgn-lions-mane-600",
    catalogId: "lions-mane",
    brand: "California Gold Nutrition",
    name: "Fungiology Organic Lion's Mane, 10:1 Full Spectrum",
    form: "veg capsule",
    counts: [90],
    perUnit: [{ name: "Lion's Mane (full spectrum)", amount: 600, unit: "mg" }],
    dosePerUnit: 600,
    labelServing: 1,
    labelTimesPerDay: 1,
    labelUse: "1 capsule daily, with or without food. With a meal if your stomach is sensitive.",
    iherbId: 82841,
  }),
  P({
    id: "host-defense-lions-mane",
    catalogId: "lions-mane",
    brand: "Host Defense",
    name: "Lion's Mane",
    form: "veg capsule",
    counts: [60, 120],
    perUnit: [{ name: "Lion's Mane (mycelium)", amount: 500, unit: "mg" }],
    dosePerUnit: 500,
    labelServing: 2,
    labelTimesPerDay: 1,
    labelUse: "2 capsules daily.",
  }),
  P({
    id: "real-mushrooms-lions-mane",
    catalogId: "lions-mane",
    brand: "Real Mushrooms",
    name: "Lion's Mane Extract",
    form: "veg capsule",
    counts: [120, 300],
    perUnit: [{ name: "Lion's Mane (fruiting body extract)", amount: 500, unit: "mg" }],
    dosePerUnit: 500,
    labelServing: 2,
    labelTimesPerDay: 1,
    labelUse: "2 capsules daily.",
  }),

  // L-Theanine
  P({
    id: "doctors-best-theanine-150",
    catalogId: "l-theanine",
    brand: "Doctor's Best",
    name: "L-Theanine with Suntheanine, 150 mg",
    form: "veg capsule",
    counts: [90],
    perUnit: [{ name: "L-Theanine (Suntheanine)", amount: 150, unit: "mg" }],
    dosePerUnit: 150,
    labelServing: 1,
    labelTimesPerDay: 1,
    labelUse: "1 capsule daily, without food.",
    iherbId: 12959,
  }),
  P({
    id: "now-theanine-200",
    catalogId: "l-theanine",
    brand: "NOW Foods",
    name: "L-Theanine Double Strength, 200 mg",
    form: "veg capsule",
    counts: [60, 120],
    perUnit: [
      { name: "L-Theanine", amount: 200, unit: "mg" },
      { name: "Inositol", amount: 100, unit: "mg" },
    ],
    dosePerUnit: 200,
    labelServing: 1,
    labelTimesPerDay: 1,
    labelUse: "1 capsule 1–3 times daily.",
  }),

  // Melatonin
  P({
    id: "now-melatonin-3",
    catalogId: "melatonin",
    brand: "NOW Foods",
    name: "Melatonin 3 mg",
    form: "veg capsule",
    counts: [60, 180],
    perUnit: [{ name: "Melatonin", amount: 3, unit: "mg" }],
    dosePerUnit: 3,
    labelServing: 1,
    labelTimesPerDay: 1,
    labelUse: "1 capsule near bedtime. Not with alcohol.",
  }),
  P({
    id: "life-extension-melatonin-300mcg",
    catalogId: "melatonin",
    brand: "Life Extension",
    name: "Melatonin 300 mcg (low dose)",
    form: "veg capsule",
    counts: [100],
    perUnit: [{ name: "Melatonin", amount: 300, unit: "mcg" }],
    dosePerUnit: 0.3,
    labelServing: 1,
    labelTimesPerDay: 1,
    labelUse: "1 capsule 30–60 minutes before bed.",
  }),
  P({
    id: "natrol-melatonin-5",
    catalogId: "melatonin",
    brand: "Natrol",
    name: "Melatonin Fast Dissolve 5 mg",
    form: "tablet",
    counts: [90, 150],
    perUnit: [{ name: "Melatonin", amount: 5, unit: "mg" }],
    dosePerUnit: 5,
    labelServing: 1,
    labelTimesPerDay: 1,
    labelUse: "1 tablet 20 minutes before bed.",
  }),

  // Omega-3 (dose = EPA + DHA)
  P({
    id: "cgn-omega3-premium",
    catalogId: "omega-3",
    brand: "California Gold Nutrition",
    name: "Omega-3 Premium Fish Oil",
    form: "softgel",
    counts: [100, 240],
    perUnit: [
      { name: "EPA", amount: 180, unit: "mg" },
      { name: "DHA", amount: 120, unit: "mg" },
      { name: "Fish oil", amount: 1100, unit: "mg" },
    ],
    dosePerUnit: 300,
    labelServing: 2,
    labelTimesPerDay: 1,
    labelUse: "2 softgels daily with food.",
    iherbId: 62118,
  }),
  P({
    id: "now-omega3-1000",
    catalogId: "omega-3",
    brand: "NOW Foods",
    name: "Omega-3 Molecularly Distilled, 1000 mg",
    form: "softgel",
    counts: [100, 200, 500],
    perUnit: [
      { name: "EPA", amount: 180, unit: "mg" },
      { name: "DHA", amount: 120, unit: "mg" },
      { name: "Fish oil", amount: 1000, unit: "mg" },
    ],
    dosePerUnit: 300,
    labelServing: 2,
    labelTimesPerDay: 1,
    labelUse: "2 softgels daily with food.",
  }),
  P({
    id: "sports-research-omega3-triple",
    catalogId: "omega-3",
    brand: "Sports Research",
    name: "Omega-3 Fish Oil, Triple Strength",
    form: "softgel",
    counts: [30, 60, 90, 120, 180],
    perUnit: [
      { name: "EPA", amount: 690, unit: "mg" },
      { name: "DHA", amount: 310, unit: "mg" },
    ],
    dosePerUnit: 1000,
    labelServing: 1,
    labelTimesPerDay: 1,
    labelUse: "1 softgel daily with food.",
  }),
  P({
    id: "nordic-ultimate-omega",
    catalogId: "omega-3",
    brand: "Nordic Naturals",
    name: "Ultimate Omega",
    form: "softgel",
    counts: [60, 120],
    perUnit: [
      { name: "EPA", amount: 325, unit: "mg" },
      { name: "DHA", amount: 225, unit: "mg" },
    ],
    dosePerUnit: 550,
    labelServing: 2,
    labelTimesPerDay: 1,
    labelUse: "2 softgels daily with food.",
  }),
  P({
    id: "nordic-ultimate-omega-2x",
    catalogId: "omega-3",
    brand: "Nordic Naturals",
    name: "Ultimate Omega 2X",
    form: "softgel",
    counts: [60, 120],
    perUnit: [
      { name: "EPA", amount: 562, unit: "mg" },
      { name: "DHA", amount: 438, unit: "mg" },
    ],
    dosePerUnit: 1000,
    labelServing: 2,
    labelTimesPerDay: 1,
    labelUse: "2 softgels daily with food.",
  }),

  // Magnesium (elemental)
  P({
    id: "doctors-best-magnesium",
    catalogId: "magnesium",
    brand: "Doctor's Best",
    name: "High Absorption Magnesium (glycinate lysinate chelate)",
    form: "tablet",
    counts: [120, 240],
    perUnit: [{ name: "Magnesium (elemental)", amount: 100, unit: "mg" }],
    dosePerUnit: 100,
    labelServing: 2,
    labelTimesPerDay: 2,
    labelUse: "2 tablets twice daily. Many start with 2 tablets in the evening.",
  }),
  P({
    id: "now-magnesium-glycinate",
    catalogId: "magnesium",
    brand: "NOW Foods",
    name: "Magnesium Glycinate",
    form: "tablet",
    counts: [180],
    perUnit: [{ name: "Magnesium (elemental)", amount: 100, unit: "mg" }],
    dosePerUnit: 100,
    labelServing: 2,
    labelTimesPerDay: 1,
    labelUse: "2 tablets daily.",
  }),

  // Vitamin D
  P({
    id: "now-d3-k2",
    catalogId: "vitamin-d",
    brand: "NOW Foods",
    name: "Vitamin D-3 & K-2, 1000 IU / 45 mcg",
    form: "veg capsule",
    counts: [120],
    perUnit: [
      { name: "Vitamin D3", amount: 1000, unit: "IU" },
      { name: "Vitamin K2 (MK-4)", amount: 45, unit: "mcg" },
    ],
    dosePerUnit: 1000,
    labelServing: 1,
    labelTimesPerDay: 1,
    labelUse: "1 capsule 1–2 times daily with food.",
  }),
  P({
    id: "now-d3-5000",
    catalogId: "vitamin-d",
    brand: "NOW Foods",
    name: "Vitamin D-3 5000 IU",
    form: "softgel",
    counts: [120, 240],
    perUnit: [{ name: "Vitamin D3", amount: 5000, unit: "IU" }],
    dosePerUnit: 5000,
    labelServing: 1,
    labelTimesPerDay: 1,
    labelUse: "1 softgel daily with a meal containing fat.",
  }),
  P({
    id: "cgn-d3-5000",
    catalogId: "vitamin-d",
    brand: "California Gold Nutrition",
    name: "Vitamin D3 125 mcg (5,000 IU)",
    form: "softgel",
    counts: [90, 360],
    perUnit: [{ name: "Vitamin D3", amount: 5000, unit: "IU" }],
    dosePerUnit: 5000,
    labelServing: 1,
    labelTimesPerDay: 1,
    labelUse: "1 softgel daily with food.",
  }),
  P({
    id: "sports-research-d3-k2",
    catalogId: "vitamin-d",
    brand: "Sports Research",
    name: "Vitamin D3 + K2 (plant-based)",
    form: "softgel",
    counts: [60, 120],
    perUnit: [
      { name: "Vitamin D3", amount: 5000, unit: "IU" },
      { name: "Vitamin K2 (MK-7)", amount: 100, unit: "mcg" },
    ],
    dosePerUnit: 5000,
    labelServing: 1,
    labelTimesPerDay: 1,
    labelUse: "1 softgel daily with food.",
  }),
  P({
    id: "now-mk7-100",
    catalogId: "vitamin-k2",
    brand: "NOW Foods",
    name: "MK-7 Vitamin K-2, 100 mcg",
    form: "veg capsule",
    counts: [60, 120],
    perUnit: [{ name: "Vitamin K2 (MK-7)", amount: 100, unit: "mcg" }],
    dosePerUnit: 100,
    labelServing: 1,
    labelTimesPerDay: 1,
    labelUse: "1 capsule daily with a meal.",
  }),

  // Ashwagandha
  P({
    id: "swanson-ashwagandha-450",
    catalogId: "ashwagandha",
    brand: "Swanson",
    name: "Full Spectrum Ashwagandha 450 mg",
    form: "capsule",
    counts: [100],
    perUnit: [{ name: "Ashwagandha root", amount: 450, unit: "mg" }],
    dosePerUnit: 450,
    labelServing: 2,
    labelTimesPerDay: 1,
    labelUse: "2 capsules 1–2 times daily; with food if it upsets your stomach.",
  }),
  P({
    id: "jarrow-ksm66-300",
    catalogId: "ashwagandha",
    brand: "Jarrow Formulas",
    name: "Ashwagandha KSM-66, 300 mg",
    form: "veg capsule",
    counts: [120],
    perUnit: [{ name: "Ashwagandha root extract (KSM-66)", amount: 300, unit: "mg" }],
    dosePerUnit: 300,
    labelServing: 1,
    labelTimesPerDay: 2,
    labelUse: "1 capsule twice daily.",
  }),

  // Adaptogens / nootropics
  P({
    id: "now-rhodiola-500",
    catalogId: "rhodiola",
    brand: "NOW Foods",
    name: "Rhodiola 500 mg",
    form: "veg capsule",
    counts: [60, 120],
    perUnit: [{ name: "Rhodiola extract", amount: 500, unit: "mg" }],
    dosePerUnit: 500,
    labelServing: 1,
    labelTimesPerDay: 1,
    labelUse: "1 capsule 1–2 times daily on an empty stomach.",
  }),
  P({
    id: "now-bacopa-450",
    catalogId: "bacopa",
    brand: "NOW Foods",
    name: "Bacopa Extract 450 mg",
    form: "veg capsule",
    counts: [90],
    perUnit: [{ name: "Bacopa extract (40% bacosides)", amount: 450, unit: "mg" }],
    dosePerUnit: 450,
    labelServing: 1,
    labelTimesPerDay: 1,
    labelUse: "1 capsule daily.",
  }),
  P({
    id: "now-alpha-gpc-300",
    catalogId: "alpha-gpc",
    brand: "NOW Foods",
    name: "Alpha GPC 300 mg",
    form: "veg capsule",
    counts: [60],
    perUnit: [{ name: "Alpha GPC", amount: 300, unit: "mg" }],
    dosePerUnit: 300,
    labelServing: 2,
    labelTimesPerDay: 1,
    labelUse: "2 capsules with food, early in the day.",
  }),

  // Sport
  P({
    id: "cgn-creatine",
    catalogId: "creatine",
    brand: "California Gold Nutrition",
    name: "Sport Pure Creatine Monohydrate (powder)",
    form: "scoop",
    counts: [90, 200],
    perUnit: [{ name: "Creatine monohydrate", amount: 5, unit: "g" }],
    dosePerUnit: 5,
    labelServing: 1,
    labelTimesPerDay: 1,
    labelUse: "1 level scoop (5 g) daily in water.",
  }),
  P({
    id: "sports-research-collagen",
    catalogId: "collagen",
    brand: "Sports Research",
    name: "Collagen Peptides (powder)",
    form: "scoop",
    counts: [41],
    perUnit: [{ name: "Collagen peptides", amount: 11, unit: "g" }],
    dosePerUnit: 11,
    labelServing: 1,
    labelTimesPerDay: 1,
    labelUse: "1 scoop (11 g) daily in any drink.",
  }),

  // Minerals & vitamins
  P({
    id: "now-zinc-picolinate-50",
    catalogId: "zinc",
    brand: "NOW Foods",
    name: "Zinc Picolinate 50 mg",
    form: "veg capsule",
    counts: [60, 120],
    perUnit: [{ name: "Zinc", amount: 50, unit: "mg" }],
    dosePerUnit: 50,
    labelServing: 1,
    labelTimesPerDay: 1,
    labelUse: "1 capsule daily with a meal.",
  }),
  P({
    id: "thorne-zinc-30",
    catalogId: "zinc",
    brand: "Thorne",
    name: "Zinc Picolinate 30 mg",
    form: "capsule",
    counts: [60],
    perUnit: [{ name: "Zinc", amount: 30, unit: "mg" }],
    dosePerUnit: 30,
    labelServing: 1,
    labelTimesPerDay: 1,
    labelUse: "1 capsule daily.",
  }),
  P({
    id: "cgn-gold-c-1000",
    catalogId: "vitamin-c",
    brand: "California Gold Nutrition",
    name: "Gold C, Vitamin C 1,000 mg",
    form: "veg capsule",
    counts: [60, 240],
    perUnit: [{ name: "Vitamin C", amount: 1000, unit: "mg" }],
    dosePerUnit: 1000,
    labelServing: 1,
    labelTimesPerDay: 1,
    labelUse: "1 capsule daily.",
  }),
  P({
    id: "now-methyl-b12-1000",
    catalogId: "vitamin-b12",
    brand: "NOW Foods",
    name: "Methyl B-12, 1,000 mcg",
    form: "lozenge",
    counts: [100],
    perUnit: [{ name: "Vitamin B12 (methylcobalamin)", amount: 1000, unit: "mcg" }],
    dosePerUnit: 1000,
    labelServing: 1,
    labelTimesPerDay: 1,
    labelUse: "1 lozenge daily, dissolved in the mouth.",
  }),
  P({
    id: "life-extension-b-complex",
    catalogId: "b-complex",
    brand: "Life Extension",
    name: "BioActive Complete B-Complex",
    form: "veg capsule",
    counts: [60],
    perUnit: [
      { name: "B1", amount: 50, unit: "mg" },
      { name: "B6", amount: 50, unit: "mg" },
      { name: "Folate", amount: 340, unit: "mcg" },
      { name: "B12", amount: 150, unit: "mcg" },
    ],
    dosePerUnit: 1,
    labelServing: 2,
    labelTimesPerDay: 1,
    labelUse: "2 capsules daily with food.",
  }),
  P({
    id: "solgar-gentle-iron-25",
    catalogId: "iron",
    brand: "Solgar",
    name: "Gentle Iron 25 mg",
    form: "veg capsule",
    counts: [90, 180],
    perUnit: [{ name: "Iron (bisglycinate)", amount: 25, unit: "mg" }],
    dosePerUnit: 25,
    labelServing: 1,
    labelTimesPerDay: 1,
    labelUse: "1 capsule daily.",
  }),

  // Amino acids
  P({
    id: "now-glycine-1000",
    catalogId: "glycine",
    brand: "NOW Foods",
    name: "Glycine 1000 mg",
    form: "veg capsule",
    counts: [100],
    perUnit: [{ name: "Glycine", amount: 1000, unit: "mg" }],
    dosePerUnit: 1,
    labelServing: 3,
    labelTimesPerDay: 1,
    labelUse: "1–3 capsules daily, preferably on an empty stomach.",
  }),
  P({
    id: "now-taurine-1000",
    catalogId: "taurine",
    brand: "NOW Foods",
    name: "Taurine 1000 mg",
    form: "veg capsule",
    counts: [100, 250],
    perUnit: [{ name: "Taurine", amount: 1000, unit: "mg" }],
    dosePerUnit: 1000,
    labelServing: 1,
    labelTimesPerDay: 1,
    labelUse: "1 capsule 1–2 times daily, between meals.",
  }),
  P({
    id: "now-nac-600",
    catalogId: "nac",
    brand: "NOW Foods",
    name: "NAC 600 mg",
    form: "veg capsule",
    counts: [100, 250],
    perUnit: [{ name: "N-Acetyl Cysteine", amount: 600, unit: "mg" }],
    dosePerUnit: 600,
    labelServing: 1,
    labelTimesPerDay: 2,
    labelUse: "1 capsule twice daily.",
  }),

  // Other
  P({
    id: "doctors-best-coq10-100",
    catalogId: "coq10",
    brand: "Doctor's Best",
    name: "High Absorption CoQ10 with BioPerine, 100 mg",
    form: "softgel",
    counts: [60, 120],
    perUnit: [
      { name: "CoQ10", amount: 100, unit: "mg" },
      { name: "BioPerine", amount: 5, unit: "mg" },
    ],
    dosePerUnit: 100,
    labelServing: 1,
    labelTimesPerDay: 1,
    labelUse: "1 softgel daily with food.",
    iherbId: 10930,
  }),
  P({
    id: "doctors-best-curcumin",
    catalogId: "curcumin",
    brand: "Doctor's Best",
    name: "Curcumin Phytosome (Meriva) 500 mg",
    form: "veg capsule",
    counts: [60, 180],
    perUnit: [{ name: "Curcumin phytosome", amount: 500, unit: "mg" }],
    dosePerUnit: 500,
    labelServing: 2,
    labelTimesPerDay: 1,
    labelUse: "2 capsules daily with food.",
  }),
  P({
    id: "cgn-lactobif-30",
    catalogId: "probiotic",
    brand: "California Gold Nutrition",
    name: "LactoBif 30 Probiotics, 30 Billion CFU",
    form: "veg capsule",
    counts: [60],
    perUnit: [{ name: "Probiotic (8 strains)", amount: 30, unit: "billion CFU" }],
    dosePerUnit: 1,
    labelServing: 1,
    labelTimesPerDay: 1,
    labelUse: "1 capsule daily.",
  }),
  P({
    id: "host-defense-reishi",
    catalogId: "reishi",
    brand: "Host Defense",
    name: "Reishi",
    form: "veg capsule",
    counts: [60, 120],
    perUnit: [{ name: "Reishi (mycelium)", amount: 500, unit: "mg" }],
    dosePerUnit: 500,
    labelServing: 2,
    labelTimesPerDay: 1,
    labelUse: "2 capsules daily.",
  }),
  P({
    id: "thorne-berberine-500",
    catalogId: "berberine",
    brand: "Thorne",
    name: "Berberine-500",
    form: "capsule",
    counts: [60],
    perUnit: [{ name: "Berberine", amount: 500, unit: "mg" }],
    dosePerUnit: 500,
    labelServing: 2,
    labelTimesPerDay: 1,
    labelUse: "1 capsule 2–3 times daily with meals.",
  }),
];

export const PRODUCT_BY_ID = Object.fromEntries(PRODUCTS.map((p) => [p.id, p])) as Record<
  string,
  Product
>;

export function productsFor(catalogId: string) {
  return PRODUCTS.filter((p) => p.catalogId === catalogId);
}

export function brandsFor(catalogId: string) {
  return [...new Set(productsFor(catalogId).map((p) => p.brand))];
}

const plural = (form: Form, n: number) => {
  const word = form === "veg capsule" ? "capsule" : form;
  return n === 1
    ? word
    : word === "capsule" ||
        word === "tablet" ||
        word === "lozenge" ||
        word === "scoop" ||
        word === "softgel"
      ? `${word}s`
      : word;
};

export function unitWord(form: Form | undefined, n: number) {
  return plural(form ?? "capsule", n);
}

/** "2 softgels = 360 mg EPA + 240 mg DHA" */
export function contentsLabel(perUnit: Ingredient[], units: number, form?: Form) {
  const parts = perUnit
    .filter((i) => i.name !== "Fish oil")
    .map((i) => `${fmt(i.amount * units)} ${i.unit} ${i.name}`);
  return `${units} ${unitWord(form, units)} = ${parts.join(" + ")}`;
}

function fmt(n: number) {
  return Number.isInteger(n) ? n.toLocaleString("en-US") : String(Math.round(n * 100) / 100);
}

/** Find the product a parsed iHerb title or link refers to. */
export function matchProduct(input: {
  brand?: string;
  catalogId?: string;
  amount?: number;
  iherbId?: number;
}) {
  if (input.iherbId) {
    const byId = PRODUCTS.find((p) => p.iherbId === input.iherbId);
    if (byId) return byId;
  }
  if (!input.catalogId) return undefined;
  const pool = productsFor(input.catalogId).filter((p) => !input.brand || p.brand === input.brand);
  if (!pool.length) return undefined;
  if (input.amount) {
    const exact = pool.find((p) => p.perUnit.some((i) => i.amount === input.amount));
    if (exact) return exact;
  }
  return input.brand ? pool[0] : undefined;
}
