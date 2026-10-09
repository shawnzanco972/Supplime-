import { CATALOG } from "./catalog";

export type ParsedProduct = {
  /** Clean product title, e.g. "NOW Foods, L-Theanine, 200 mg, 120 Veg Capsules". */
  title: string;
  brand?: string;
  /** Product name without brand, dose and count. */
  name: string;
  amount?: number;
  unit?: string;
  /** Capsules / tablets in the bottle. */
  count?: number;
  form?: string;
  catalogId?: string;
  url?: string;
  /** iHerb product number from the link, e.g. 62118. */
  iherbId?: number;
};

const BRANDS = [
  "California Gold Nutrition",
  "NOW Foods",
  "Doctor's Best",
  "Life Extension",
  "Jarrow Formulas",
  "Solgar",
  "Nature's Way",
  "Thorne",
  "Sports Research",
  "Natrol",
  "Host Defense",
  "Real Mushrooms",
  "Garden of Life",
  "Nordic Naturals",
  "21st Century",
  "Nature Made",
  "Swanson",
  "Source Naturals",
  "Nutricost",
  "Pure Encapsulations",
  "Lake Avenue Nutrition",
  "Zhou Nutrition",
  "Nootropics Depot",
  "Mushroom Design",
  "Carlson",
  "Nested Naturals",
  "Healthy Origins",
  "Country Life",
  "Bluebonnet Nutrition",
  "Nature's Bounty",
  "Kirkland Signature",
  "Optimum Nutrition",
  "MRM Nutrition",
  "Om Mushrooms",
  "Paradise Herbs",
  "Gaia Herbs",
  "Solaray",
  "Puritan's Pride",
  "Vital Proteins",
  "Sundown Naturals",
];

const FORMS =
  "veg(?:etarian|gie)?\\s*capsules|veggie\\s*caps|vcaps|plant[- ]based\\s*capsules|capsules|softgels|liquid\\s*softgels|tablets|chewables|gummies|lozenges|caplets|capsule|tablet|softgel|gummy";

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9.]+/g, " ")
    .trim();

/**
 * Read an iHerb link or the text the iHerb app shares, e.g.
 *   https://www.iherb.com/pr/now-foods-l-theanine-200-mg-120-veg-capsules/54096
 *   "Check out NOW Foods, L-Theanine, 200 mg, 120 Veg Capsules on iHerb! https://iherb.co/abc"
 * Works offline: everything comes from the text itself.
 */
export function parseProduct(input: string): ParsedProduct | null {
  const raw = input.trim();
  if (!raw) return null;
  const url = raw.match(/https?:\/\/\S+/)?.[0];
  let text = raw
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/^\s*(check out|look at|i found)\s+/i, "")
    .replace(/\s+(on|at|from)\s+iherb.*$/i, "")
    .replace(/[!]+/g, " ")
    .trim();

  // A bare product URL: use its slug.
  if (!text && url) {
    const slug = url.match(/\/pr\/([^/?#]+)/)?.[1];
    if (!slug) return null;
    text = decodeURIComponent(slug)
      // "0-5-mg" in a slug means 0.5 mg
      .replace(
        /(^|-)(\d+)-(\d+)-(mg|mcg|g|iu)(?=-|$)/gi,
        (_, pre, a, b, u) => `${pre}${a}.${b}-${u}`,
      )
      .replace(/-/g, " ")
      // "lion s mane" -> "lion's mane", "doctor s best" -> "doctor's best"
      .replace(/\b([a-z]+) s\b/g, "$1's");
  }
  if (!text) return null;

  const dose = text.match(/(\d+(?:[.,]\d+)?)\s*(mg|mcg|µg|g|iu|billion\s*cfu)\b/i);
  const count = text.match(new RegExp(`(\\d+)\\s*(${FORMS})\\b`, "i"));
  const n = norm(text);
  const brand = BRANDS.find((b) => n.startsWith(norm(b)) || n.includes(` ${norm(b)} `));

  // Product name: the title minus brand, dose, count and filler.
  let name = text;
  if (brand)
    name = name.replace(
      new RegExp(`^\\s*${brand.replace(/[.*+?^${}()|[\]\\']/g, ".?")}\\s*,?\\s*`, "i"),
      "",
    );
  if (brand && name === text) {
    const words = brand.split(/\s+/).length;
    name = text.split(/\s+/).slice(words).join(" ");
  }
  name = name
    .replace(dose?.[0] ?? "\u0000", "")
    .replace(count?.[0] ?? "\u0000", "")
    .replace(/\b(double|extra|triple)\s+strength\b/gi, "")
    .replace(/\s*,\s*,+/g, ",")
    .replace(/(^[\s,]+|[\s,]+$)/g, "")
    .replace(/\s{2,}/g, " ");
  const firstPart = name.split(",")[0]?.trim() || name;

  const unitRaw = dose?.[2]?.toLowerCase().replace(/\s+/g, " ");
  const unit =
    unitRaw === "iu"
      ? "IU"
      : unitRaw === "µg"
        ? "mcg"
        : unitRaw === "billion cfu"
          ? "billion CFU"
          : unitRaw;

  return {
    title: text.replace(/\s{2,}/g, " ").trim(),
    brand,
    name: titleCase(firstPart),
    amount: dose ? Number(dose[1]!.replace(",", ".")) : undefined,
    unit,
    count: count ? Number(count[1]) : undefined,
    form: count?.[2]?.toLowerCase().replace(/\s+/g, " "),
    catalogId: matchCatalog(n),
    url,
    iherbId: url
      ? Number(url.match(/\/pr\/(?:[^/?#]+\/)?(\d{2,7})(?:[/?#]|$)/)?.[1]) || undefined
      : undefined,
  };
}

/** Find the guide entry a product title refers to (longest name or alias wins). */
export function matchCatalog(normalized: string): string | undefined {
  const hay = ` ${normalized} `;
  let best: { id: string; len: number } | undefined;
  for (const item of CATALOG) {
    for (const term of [item.name, item.id.replace(/-/g, " "), ...item.aliases]) {
      const t = norm(term.replace(/\(.*?\)/g, ""));
      if (t.length < 2) continue;
      if (hay.includes(` ${t} `) && (!best || t.length > best.len))
        best = { id: item.id, len: t.length };
    }
  }
  return best?.id;
}

function titleCase(s: string) {
  if (s !== s.toLowerCase()) return s;
  return s.replace(/(^|[\s-])([a-z])/g, (_, pre, c) => pre + c.toUpperCase());
}

/** An iHerb link that doesn't name the product itself, e.g. the app's iherb.co share links. */
export function isShortLink(text: string) {
  const url = text.match(/https?:\/\/\S+/)?.[0];
  return !!url && /iherb\.co\b|iherb\.com\/(?!pr\/)/i.test(url) && !/\/pr\//.test(url);
}

/**
 * Follow a short iHerb link (https://iherb.co/UzUjrEP7) to the product page and return
 * text parseProduct understands: the product title plus its /pr/ URL. On the phone the
 * request goes through the native HTTP client, so redirects and CORS aren't a problem.
 */
export async function resolveShortLink(text: string): Promise<string | null> {
  const url = text.match(/https?:\/\/\S+/)?.[0];
  if (!url) return null;
  try {
    const { CapacitorHttp } = await import("@capacitor/core");
    const res = await CapacitorHttp.get({
      url,
      headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile" },
      responseType: "text",
    });
    const finalUrl = typeof res.url === "string" ? res.url : "";
    const html = typeof res.data === "string" ? res.data : "";
    const pr =
      (/\/pr\//.test(finalUrl) ? finalUrl : undefined) ??
      html.match(/https?:\/\/(?:[a-z]+\.)?iherb\.com\/pr\/[^"'\s<>]+/i)?.[0];
    const title =
      html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
      html.match(/<title>([^<]+)<\/title>/i)?.[1];
    const clean = title
      ?.replace(/&amp;/g, "&")
      .replace(/&#39;|&apos;/g, "'")
      .replace(/\s*[-|]\s*iHerb.*$/i, "")
      .trim();
    if (!pr && !clean) return null;
    return [clean, pr].filter(Boolean).join(" ");
  } catch {
    return null;
  }
}
