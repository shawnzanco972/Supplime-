import { MessageCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Chip, Section } from "@/components/fields";
import { Button } from "@/components/ui/button";
import { Screen } from "@/components/ui/screen";
import { Textarea } from "@/components/ui/textarea";
import { parseSetup, setupPrompt, type SetupImport } from "@/lib/ai-setup";
import { CATALOG_BY_ID } from "@/lib/catalog";
import { shareToAssistant } from "@/lib/coach";
import { useNav } from "@/lib/nav";
import { appToday, useSupplime } from "@/lib/store";

/** Send the short interview to the person's own AI app, then read its answer back. */
export function AiSetupSteps({
  today,
  initialText = "",
  submitLabel,
  onImport,
}: {
  today: string;
  initialText?: string;
  submitLabel: string;
  onImport: (x: SetupImport) => void;
}) {
  const [text, setText] = useState(initialText);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="font-medium">1. Send a few questions to Claude or Gemini</p>
        <Button
          className="mt-2 w-full"
          variant={sent ? "outline" : "default"}
          onClick={async () => {
            const how = await shareToAssistant(setupPrompt(today));
            setSent(true);
            if (how === "copied") toast("Copied. Paste it into Claude or Gemini.");
          }}
        >
          <MessageCircle className="size-4" />
          {sent ? "Send again" : "Open my AI app"}
        </Button>
      </div>
      <div>
        <p className="font-medium">2. Answer briefly</p>
        <p className="text-muted-foreground">
          About 4 short questions. Rough answers are fine; it fills in sensible guesses.
        </p>
      </div>
      <div>
        <p className="font-medium">3. Paste its last answer here</p>
        <p className="text-muted-foreground">Or share it straight to Supplime.</p>
        <Textarea
          className="mt-2 min-h-28 font-mono text-xs"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setError("");
          }}
          placeholder='{"supplime": 1, …}'
        />
        {error && <p className="mt-1 text-warn">{error}</p>}
      </div>
      <Button
        className="w-full"
        size="lg"
        disabled={!text.trim()}
        onClick={() => {
          const parsed = parseSetup(text, today);
          if (parsed) onImport(parsed);
          else
            setError("Couldn't read that. Copy the whole last answer, including the part in { }.");
        }}
      >
        {submitLabel}
      </Button>
    </div>
  );
}

/** After setup: bring in what your AI wrote, and choose what to apply. */
export function AiImportScreen({ text }: { text?: string }) {
  const close = useNav((s) => s.close);
  const { stack, importSetup } = useSupplime();
  const today = appToday();
  const [found, setFound] = useState<SetupImport | null>(() =>
    text ? parseSetup(text, today) : null,
  );
  const [withDay, setWithDay] = useState(false);
  const owned = new Set(
    stack.filter((i) => !i.archived).map((i) => i.catalogId ?? i.name.toLowerCase()),
  );
  const fresh = (found?.items ?? []).filter(
    (i) => !owned.has(i.catalogId ?? (i.name ?? "").toLowerCase()),
  );
  const hasDay =
    !!found && (Object.keys(found.rhythm).length > 0 || Object.keys(found.habits).length > 0);
  return (
    <Screen
      onClose={close}
      title="Import from your AI"
      subtitle="Add what you already take in one go"
    >
      {!found ? (
        <AiSetupSteps today={today} initialText={text} submitLabel="Read it" onImport={setFound} />
      ) : (
        <div className="space-y-4">
          <Section title={fresh.length ? `${fresh.length} to add` : "Nothing new to add"}>
            <ul className="space-y-1 text-sm">
              {fresh.map((i) => (
                <li key={i.catalogId ?? i.name}>
                  {(i.catalogId && CATALOG_BY_ID[i.catalogId]?.name) || i.name}
                  {i.amount ? ` · ${i.amount} ${i.unit ?? ""}` : ""}
                  {i.startedAt && i.startedAt < today ? ` · since ${i.startedAt}` : ""}
                </li>
              ))}
              {found.items.length > fresh.length && (
                <li className="text-muted-foreground">
                  Already in your cabinet: {found.items.length - fresh.length}
                </li>
              )}
            </ul>
          </Section>
          {hasDay && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Chip on={!withDay} onClick={() => setWithDay(false)}>
                Keep my day as it is
              </Chip>
              <Chip on={withDay} onClick={() => setWithDay(true)}>
                Also update my day and habits
              </Chip>
            </div>
          )}
          <Button
            className="w-full"
            size="lg"
            disabled={!fresh.length && !withDay}
            onClick={() => {
              const n = importSetup({ ...found, items: fresh }, withDay);
              toast(n ? `Added ${n} to your cabinet` : "Your day is updated", {
                description: n ? "Check each one's dose and times in the Cabinet." : undefined,
              });
              close();
            }}
          >
            {fresh.length ? `Add ${fresh.length}` : "Update my day"}
          </Button>
          <button
            type="button"
            className="min-h-11 w-full text-sm text-muted-foreground underline"
            onClick={() => setFound(null)}
          >
            Paste a different answer
          </button>
        </div>
      )}
    </Screen>
  );
}
