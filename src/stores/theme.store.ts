/**
 * Theme store — pure Zustand state for the user's chosen theme mode.
 *
 * Pure means: no module-level side effects. Constructing this store doesn't
 * touch the DOM, doesn't read localStorage, doesn't register any listeners.
 * That happens in `src/components/ThemeInit.tsx`, which owns the lifecycle.
 *
 * The store starts with the default mode and resolves it eagerly via
 * `resolveTheme`, which is SSR-safe. On the browser, `ThemeInit` then
 * dispatches `setMode(loadStoredMode())` once on mount to hydrate the real
 * preference from localStorage.
 *
 * Design rationale: keeping the store pure means it can be safely imported by
 * server-rendered client components without doing anything sketchy at import
 * time, and it makes the data flow obvious — every state change goes through
 * `setMode`, every side effect is centralized in one lifecycle component.
 */

import { create } from "zustand";
import {
  DEFAULT_THEME_MODE,
  applyTheme,
  resolveTheme,
  saveStoredMode,
  type ResolvedTheme,
  type ThemeMode,
} from "@/lib/theme";

interface ThemeState {
  mode: ThemeMode;
  resolved: ResolvedTheme;
  /**
   * Set the user's chosen mode. Persists to localStorage and applies to the
   * DOM in one atomic step. The lifecycle component (`ThemeInit`) calls this
   * for both user-initiated changes and OS-preference changes when mode is
   * `"system"`.
   */
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: DEFAULT_THEME_MODE,
  resolved: resolveTheme(DEFAULT_THEME_MODE),
  setMode: (mode) => {
    const resolved = resolveTheme(mode);
    saveStoredMode(mode);
    applyTheme(resolved);
    set({ mode, resolved });
  },
}));

export type { ThemeMode };
