"use client";

import { create } from "zustand";
import { devtools } from "zustand/middleware";

interface PluginSelectionState {
  /** Currently selected plugin ID (global — applies to current chat). */
  selectedPluginId: string | null;
}

interface PluginSelectionActions {
  setSelectedPlugin: (pluginId: string | null) => void;
  clearSelectedPlugin: () => void;
}

export const usePluginStore = create<
  PluginSelectionState & PluginSelectionActions
>()(
  devtools(
    (set) => ({
      selectedPluginId: null,

      setSelectedPlugin: (pluginId) =>
        set({ selectedPluginId: pluginId }, false, "setSelectedPlugin"),

      clearSelectedPlugin: () =>
        set({ selectedPluginId: null }, false, "clearSelectedPlugin"),
    }),
    { name: "PluginStore" },
  ),
);
