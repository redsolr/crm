import { create } from "zustand";

export type OverlayView = "settings" | "plan" | "help" | "packs" | null;

/** Map pathname → overlay view */
export const OVERLAY_PATHS: Record<string, OverlayView> = {
  "/settings": "settings",
  "/pricing": "plan",
  "/contact": "help",
  "/packs": "packs",
};

/** Map overlay view → pathname */
export const OVERLAY_TO_PATH: Record<string, string> = {
  settings: "/settings/account",
  plan: "/pricing",
  help: "/contact",
  packs: "/packs",
};

export function isOverlayPath(pathname: string): boolean {
  if (pathname.startsWith("/settings")) return true;
  if (pathname.startsWith("/packs")) return true;
  return pathname in OVERLAY_PATHS;
}

export function getOverlayFromPath(pathname: string): OverlayView {
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/packs")) return "packs";
  return OVERLAY_PATHS[pathname] ?? null;
}

interface LayoutUIState {
  isAccountMenuOpen: boolean;
  returnPath: string;

  setReturnPath: (path: string) => void;
  toggleAccountMenu: () => void;
  closeAccountMenu: () => void;
}

export const useLayoutUI = create<LayoutUIState>((set) => ({
  isAccountMenuOpen: false,
  returnPath: "/",

  setReturnPath: (path) => set({ returnPath: path }),
  toggleAccountMenu: () =>
    set((s) => ({ isAccountMenuOpen: !s.isAccountMenuOpen })),
  closeAccountMenu: () => set({ isAccountMenuOpen: false }),
}));
