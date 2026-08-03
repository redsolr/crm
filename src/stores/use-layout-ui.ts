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
  /** Mobile-only sidebar drawer (<768px). Desktop ignores this — the
   *  rail is always visible there; CSS scopes the drawer behavior. */
  isMobileSidebarOpen: boolean;
  /** Command palette (⌘K). Store-held (not palette-local state) so the
   *  mobile topbar's search icon can open it — on phones the palette
   *  IS the search surface. */
  isCommandPaletteOpen: boolean;
  returnPath: string;

  setReturnPath: (path: string) => void;
  toggleAccountMenu: () => void;
  closeAccountMenu: () => void;
  toggleMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  toggleCommandPalette: () => void;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;
}

export const useLayoutUI = create<LayoutUIState>((set) => ({
  isAccountMenuOpen: false,
  isMobileSidebarOpen: false,
  isCommandPaletteOpen: false,
  returnPath: "/",

  setReturnPath: (path) => set({ returnPath: path }),
  toggleAccountMenu: () =>
    set((s) => ({ isAccountMenuOpen: !s.isAccountMenuOpen })),
  closeAccountMenu: () => set({ isAccountMenuOpen: false }),
  toggleMobileSidebar: () =>
    set((s) => ({ isMobileSidebarOpen: !s.isMobileSidebarOpen })),
  closeMobileSidebar: () => set({ isMobileSidebarOpen: false }),
  toggleCommandPalette: () =>
    set((s) => ({ isCommandPaletteOpen: !s.isCommandPaletteOpen })),
  openCommandPalette: () => set({ isCommandPaletteOpen: true }),
  closeCommandPalette: () => set({ isCommandPaletteOpen: false }),
}));
