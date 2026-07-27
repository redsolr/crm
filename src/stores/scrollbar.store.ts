import { create } from "zustand";

interface ScrollbarState {
  /** The scrollable element that the custom scrollbar should control */
  scrollEl: HTMLDivElement | null;
  /** Register a scrollable element — call on mount */
  setScrollEl: (el: HTMLDivElement | null) => void;
  /** Clear the scrollable element — call on unmount */
  clear: () => void;
}

export const useScrollbarStore = create<ScrollbarState>((set) => ({
  scrollEl: null,
  setScrollEl: (el) => set({ scrollEl: el }),
  clear: () => set({ scrollEl: null }),
}));
