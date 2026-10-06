import { create } from "zustand";

export type Tab = "today" | "stack" | "record" | "body";

type NavStore = {
  tab: Tab;
  /** Stack item to open in the editor when the Stack tab shows. */
  focusItem: string | null;
  go: (tab: Tab, focusItem?: string | null) => void;
  clearFocus: () => void;
};

export const useNav = create<NavStore>()((set) => ({
  tab: "today",
  focusItem: null,
  go: (tab, focusItem = null) => {
    set({ tab, focusItem });
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  },
  clearFocus: () => set({ focusItem: null }),
}));
