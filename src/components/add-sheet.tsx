import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { searchCatalog } from "@/lib/catalog";
import { useSupplime } from "@/lib/store";
import { FOOD_TIMINGS, SLOTS, type FoodTiming, type SlotId } from "@/lib/types";
import { foodLabel } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function AddSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const addFromCatalog = useSupplime((s) => s.addFromCatalog);
  const addCustom = useSupplime((s) => s.addCustom);
  const stack = useSupplime((s) => s.stack);
  const [query, setQuery] = useState("");
  const [custom, setCustom] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("1");
  const [unit, setUnit] = useState("mg");
  const [food, setFood] = useState<FoodTiming>("with");
  const [slots, setSlots] = useState<SlotId[]>(["breakfast"]);

  const results = useMemo(() => searchCatalog(query), [query]);
  const have = new Set(stack.map((s) => s.catalogId));

  function toggleSlot(id: SlotId) {
    setSlots((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{custom ? "Custom supplement" : "Add to stack"}</DialogTitle>
          <DialogDescription>
            {custom
              ? "Name it, set the window, and Supplime will remind and count stock."
              : "Search the guide, or add something it doesn't know yet."}
          </DialogDescription>
        </DialogHeader>

        {!custom ? (
          <>
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Lion's Mane, magnesium, theanine…"
              autoFocus
            />
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
              {results.map((item) => {
                const already = have.has(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={already}
                    onClick={() => {
                      addFromCatalog(item.id);
                      toast(`Added ${item.name}`);
                      onOpenChange(false);
                    }}
                    className="w-full rounded-lg bg-secondary/60 px-3 py-3 text-left disabled:opacity-50"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {already ? "In stack" : item.typicalDose}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{item.summary}</p>
                  </button>
                );
              })}
            </div>
            <Button variant="outline" className="mt-3 w-full" onClick={() => setCustom(true)}>
              Add something else
            </Button>
          </>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim() || slots.length === 0) return;
              addCustom({
                name,
                amount: Number(amount) || 1,
                unit,
                foodTiming: food,
                slots,
              });
              toast(`Added ${name.trim()}`);
              onOpenChange(false);
            }}
          >
            <div>
              <Label htmlFor="custom-name">Name</Label>
              <Input
                id="custom-name"
                className="mt-2"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="amt">Dose</Label>
                <Input
                  id="amt"
                  className="mt-2"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="unit">Unit</Label>
                <Input
                  id="unit"
                  className="mt-2"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>With food</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {FOOD_TIMINGS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setFood(t)}
                    className={cn(
                      "h-10 rounded-full px-3 text-xs font-medium",
                      food === t ? "bg-primary text-primary-foreground" : "bg-secondary",
                    )}
                  >
                    {foodLabel(t)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label>Windows</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {SLOTS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleSlot(s.id)}
                    className={cn(
                      "h-10 rounded-full px-3 text-xs font-medium",
                      slots.includes(s.id) ? "bg-primary text-primary-foreground" : "bg-secondary",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setCustom(false)}>
                Back
              </Button>
              <Button type="submit" className="flex-1">
                Save
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
