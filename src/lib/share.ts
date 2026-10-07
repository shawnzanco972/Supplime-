import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import { isNative } from "./platform";

type ShareInbox = {
  take(): Promise<{ text?: string | null }>;
  addListener(event: "share", fn: (data: { text?: string }) => void): Promise<PluginListenerHandle>;
};

const ShareInbox = registerPlugin<ShareInbox>("ShareInbox");

/** Text shared to Supplime from another app (e.g. an iHerb product). */
export function listenForShares(onText: (text: string) => void): () => void {
  if (!isNative()) return () => {};
  let last = "";
  let lastAt = 0;
  const deliver = (text?: string | null) => {
    if (!text) return;
    // The same share can arrive both as a pending value and as an event.
    if (text === last && Date.now() - lastAt < 3000) return;
    last = text;
    lastAt = Date.now();
    onText(text);
  };
  const handle = ShareInbox.addListener("share", (d) => deliver(d.text));
  void ShareInbox.take()
    .then((r) => deliver(r.text))
    .catch(() => {});
  return () => void handle.then((h) => h.remove());
}
