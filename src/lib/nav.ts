import { create } from "zustand";
import type { SlotId } from "./types";

export type Tab = "today" | "stack" | "journey" | "body";

/** Full-screen panels and sheets, opened from anywhere and rendered once by AppFrame. */
export type Overlay =
  | { kind: "editor"; itemId: string }
  | { kind: "evaluate"; itemId: string }
  | { kind: "add"; text?: string; catalogId?: string }
  | { kind: "not-now"; itemId: string; slot: SlotId; date: string }
  | { kind: "settings" }
  | { kind: "history"; itemId?: string }
  | { kind: "ai-import"; text?: string }
  | { kind: "privacy" }
  | null;

type NavStore = {
  tab: Tab;
  overlay: Overlay;
  /** Text shared to Supplime before setup is finished (e.g. a setup block from an AI app). */
  inbox: string | null;
  /** A window to bring into view on Today (opened from its reminder). */
  focus: SlotId | null;
  /** Switch tabs. `anchor` scrolls to an element id once the tab has rendered. */
  go: (tab: Tab, anchor?: string) => void;
  open: (overlay: Overlay) => void;
  close: () => void;
};

export const useNav = create<NavStore>()((set) => ({
  tab: "today",
  overlay: null,
  inbox: null,
  focus: null,
  go: (tab, anchor) => {
    set({ tab });
    if (typeof window === "undefined") return;
    window.scrollTo({ top: 0 });
    if (anchor) scrollToAnchor(anchor);
  },
  open: (overlay) => set({ overlay }),
  close: () => set({ overlay: null }),
}));

/** Waits for the element to render (tabs mount lazily), then scrolls it into view. */
function scrollToAnchor(id: string, tries = 60) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  if (tries > 0) window.setTimeout(() => scrollToAnchor(id, tries - 1), 100);
}
