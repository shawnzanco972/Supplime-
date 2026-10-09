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
  | null;

type NavStore = {
  tab: Tab;
  overlay: Overlay;
  go: (tab: Tab) => void;
  open: (overlay: Overlay) => void;
  close: () => void;
};

export const useNav = create<NavStore>()((set) => ({
  tab: "today",
  overlay: null,
  go: (tab) => {
    set({ tab });
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  },
  open: (overlay) => set({ overlay }),
  close: () => set({ overlay: null }),
}));
