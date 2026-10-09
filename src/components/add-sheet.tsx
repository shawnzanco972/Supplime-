import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ItemSetupForm, type SetupSeed } from "@/components/item-setup";
import { BrandBadge, ProductPicker } from "@/components/product-picker";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Textarea } from "@/components/ui/textarea";
import { CATALOG_BY_ID } from "@/lib/catalog";
import { isShortLink, parseProduct, resolveShortLink } from "@/lib/iherb";
import { useNav } from "@/lib/nav";
import { contentsLabel, matchProduct, type Product } from "@/lib/products";
import { SwitchBottle } from "@/components/switch-bottle";
import { appToday, useSupplime } from "@/lib/store";
import { cn } from "@/lib/utils";

type Mode = "browse" | "iherb";

/** Add a supplement: browse type → brand → bottle, or paste/share an iHerb product. */
export function AddScreen({ text, catalogId }: { text?: string; catalogId?: string }) {
  const close = useNav((s) => s.close);
  const stack = useSupplime((s) => s.stack);
  const profile = useSupplime((s) => s.profile);
  const addItem = useSupplime((s) => s.addItem);
  const [mode, setMode] = useState<Mode>(text ? "iherb" : "browse");
  const [seed, setSeed] = useState<SetupSeed | null>(null);
  const [switching, setSwitching] = useState<{ itemId: string; product: Product } | null>(null);
  const today = appToday();

  if (switching) {
    return (
      <SwitchBottle
        itemId={switching.itemId}
        product={switching.product}
        onBack={() => setSwitching(null)}
        onDone={close}
      />
    );
  }

  if (seed) {
    return (
      <Screen
        onClose={() => setSeed(null)}
        title="Set it up"
        subtitle="Pre-filled from the label and the guide"
      >
        <ItemSetupForm
          seed={seed}
          today={today}
          times={profile.slotTimes}
          submitLabel="Add to my cabinet"
          onSubmit={(item) => {
            const id = addItem(item);
            if (!id) return toast.error("Give it a name first.");
            const added = useSupplime.getState().stack.find((i) => i.id === id);
            toast(`Added ${added?.name ?? "it"}`, {
              description:
                item.stage === "ordered"
                  ? "On the way. Tap “It arrived” in Cabinet when it does."
                  : item.stage === "interested"
                    ? "Saved under Interested in Cabinet."
                    : item.planned
                      ? "In your cabinet. Supplime will tell you when it's a good time to start."
                      : item.backfill
                        ? "History rebuilt from your start date."
                        : "Day 1 starts now.",
            });
            close();
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen onClose={close} title="Add a supplement">
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
        {(
          [
            ["browse", "Browse"],
            ["iherb", "iHerb link"],
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
      {mode === "browse" ? (
        <ProductPicker
          owned={stack}
          initialType={catalogId}
          onPick={(p) =>
            p.switchFor && p.product
              ? setSwitching({ itemId: p.switchFor, product: p.product })
              : p.switchFor
                ? // A brand Supplime doesn't know: change the strength in the editor.
                  useNav.getState().open({ kind: "editor", itemId: p.switchFor })
                : setSeed(p.custom ? {} : p)
          }
        />
      ) : (
        <IherbPaste initial={text} onPick={setSeed} />
      )}
    </Screen>
  );
}

function IherbPaste({ initial, onPick }: { initial?: string; onPick: (s: SetupSeed) => void }) {
  const [text, setText] = useState(initial ?? "");
  // Short share links (iherb.co/…) don't name the product: follow them to the product page.
  const [resolved, setResolved] = useState<{ from: string; text: string | null } | null>(null);
  const short = isShortLink(text) && !parseProduct(text)?.brand;
  const looking = short && resolved?.from !== text;
  useEffect(() => {
    if (!short) return;
    let live = true;
    void resolveShortLink(text).then((r) => live && setResolved({ from: text, text: r }));
    return () => {
      live = false;
    };
  }, [short, text]);
  const source =
    short && resolved?.from === text && resolved.text ? `${resolved.text} ${text}` : text;
  const parsed = useMemo(() => {
    const p = parseProduct(source);
    // A short link alone isn't a product.
    return p && (p.brand || p.catalogId || p.iherbId || p.amount) ? p : null;
  }, [source]);
  const product = parsed
    ? matchProduct({
        iherbId: parsed.iherbId,
        brand: parsed.brand,
        catalogId: parsed.catalogId,
        amount: parsed.amount,
      })
    : undefined;
  const cat =
    (product?.catalogId ?? parsed?.catalogId)
      ? CATALOG_BY_ID[(product?.catalogId ?? parsed?.catalogId)!]
      : undefined;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        In the iHerb app open the product and tap{" "}
        <span className="font-medium text-foreground">Share → Supplime</span>, or paste the product
        link or title here.
      </p>
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="https://www.iherb.com/pr/…  or  NOW Foods, Melatonin, 3 mg, 60 Veg Capsules"
        className="min-h-28"
      />
      {looking && <p className="text-sm text-muted-foreground">Looking up the product…</p>}
      {text.trim() && !parsed && !looking && (
        <p className="text-sm text-warn">
          {short
            ? "Couldn't open that iHerb link. Use Share → Supplime from the iHerb app (it sends the product name too), or type the product name."
            : "Couldn't read a product from that. Try the full link or title."}
        </p>
      )}
      {parsed && (
        <div className="space-y-2 rounded-2xl bg-card p-4 shadow-[var(--shadow-border)]">
          <div className="flex items-center gap-3">
            {(product?.brand ?? parsed.brand) && (
              <BrandBadge brand={(product?.brand ?? parsed.brand)!} />
            )}
            <div className="min-w-0">
              <p className="font-medium">{product?.name ?? parsed.name}</p>
              <p className="text-xs text-muted-foreground">
                {product?.brand ?? parsed.brand ?? "Unknown brand"}
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            {product
              ? contentsLabel(product.perUnit, 1, product.form)
              : [
                  parsed.amount && `${parsed.amount} ${parsed.unit}`,
                  parsed.count && `${parsed.count} ${parsed.form ?? ""}`,
                ]
                  .filter(Boolean)
                  .join(" · ") || "No dose found — you can enter it next."}
          </p>
          <p className="text-sm">
            {product
              ? "Exact product found — strength, ingredients and directions filled in."
              : cat
                ? `Matched the guide: ${cat.name}. Check the strength on your label.`
                : "Not in the guide yet — you'll set how long it takes."}
          </p>
          <Button
            className="mt-2 w-full"
            onClick={() =>
              onPick(
                product
                  ? {
                      catalogId: product.catalogId,
                      product,
                      count: parsed.count,
                      source: { url: parsed.url, brand: product.brand, title: parsed.title },
                    }
                  : {
                      catalogId: parsed.catalogId,
                      name: cat ? cat.name : parsed.name,
                      amount:
                        cat && parsed.unit && cat.unit.toLowerCase() !== parsed.unit.toLowerCase()
                          ? undefined
                          : parsed.amount,
                      unit:
                        cat && parsed.unit && cat.unit.toLowerCase() !== parsed.unit.toLowerCase()
                          ? undefined
                          : parsed.unit,
                      count: parsed.count,
                      source: { url: parsed.url, brand: parsed.brand, title: parsed.title },
                    },
              )
            }
          >
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}
