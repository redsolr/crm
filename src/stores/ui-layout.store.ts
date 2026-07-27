import { create } from "zustand";
import { uiLayoutApi } from "@/lib/ui-layout/client";
import type {
  PanelKey,
  UiLayoutPreferences,
} from "@/lib/ui-layout/schemas";

/**
 * Two-tier persistence for UI layout prefs:
 *
 *   1. **In-memory Zustand** — read by `useResizePanel` every render,
 *      updated immediately on drag-end. Zero latency for the active
 *      session, regardless of backend availability.
 *   2. **localStorage** — mirrors the in-memory state synchronously
 *      so a reload-on-the-same-browser restores widths without
 *      waiting for the network. Acts as offline cache.
 *   3. **Backend (`/user-preferences/ui-layout`)** — debounced
 *      PATCH after drag-end so a user adjusting across devices sees
 *      the same widths. Fire-and-forget; failures don't roll back
 *      the in-memory state because the user's local experience
 *      already committed.
 *
 * Hydration (on app boot):
 *   - Read localStorage synchronously (fastest first paint)
 *   - Kick off backend GET; on success, deep-merge into the store
 *     (backend is authoritative for cross-device state)
 *
 * Why not a single source of truth: panel drags are high-frequency
 * (mouse-move throttled to 60fps). Round-tripping each event through
 * the backend would pegging a PATCH every ~16ms. The three tiers
 * trade staleness for responsiveness in the right direction.
 */

interface UiLayoutState {
  panelWidths: UiLayoutPreferences["panelWidths"];
  hydrated: boolean;
  /** True while the boot-time backend GET is in flight. Exposed so
   *  panels can render the default width without flashing a stale
   *  localStorage value if we want — currently unused; kept for
   *  future tuning. */
  loading: boolean;
  setPanelWidth: (key: PanelKey, width: number) => void;
  hydrate: () => Promise<void>;
  reset: () => void;
}

const LOCAL_STORAGE_KEY = "ui-layout-v1";
const DEBOUNCE_MS = 500;

function readLocal(): UiLayoutPreferences["panelWidths"] {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw == null || raw === "") return undefined;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "panelWidths" in parsed &&
      typeof (parsed as { panelWidths: unknown }).panelWidths === "object"
    ) {
      return (parsed as { panelWidths: UiLayoutPreferences["panelWidths"] })
        .panelWidths;
    }
  } catch (err) {
    console.warn("[ui-layout] localStorage read failed", err);
  }
  return undefined;
}

function writeLocal(widths: UiLayoutPreferences["panelWidths"]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({ v: 1, panelWidths: widths ?? {} }),
    );
  } catch (err) {
    console.warn("[ui-layout] localStorage write failed", err);
  }
}

/**
 * Per-key debounce timers. A drag on the sidebar followed by a drag
 * on the chat panel should fire two independent PATCHes, not
 * serialize behind one 500ms window.
 */
const patchTimers = new Map<PanelKey, ReturnType<typeof setTimeout>>();

function schedulePatch(key: PanelKey, value: number) {
  const existing = patchTimers.get(key);
  if (existing != null) clearTimeout(existing);
  const timer = setTimeout(() => {
    patchTimers.delete(key);
    void uiLayoutApi
      .patch({ panelWidths: { [key]: value } })
      .catch((err: unknown) => {
        console.warn(`[ui-layout] PATCH for ${key} failed`, err);
      });
  }, DEBOUNCE_MS);
  patchTimers.set(key, timer);
}

export const useUiLayoutStore = create<UiLayoutState>((set, get) => ({
  panelWidths: readLocal(),
  hydrated: false,
  loading: false,

  setPanelWidth: (key, width) => {
    const next: UiLayoutPreferences["panelWidths"] = {
      ...(get().panelWidths ?? {}),
      [key]: width,
    };
    set({ panelWidths: next });
    writeLocal(next);
    schedulePatch(key, width);
  },

  hydrate: async () => {
    if (get().hydrated) return;
    set({ loading: true });
    try {
      const server = await uiLayoutApi.get();
      const merged: UiLayoutPreferences["panelWidths"] = {
        ...(get().panelWidths ?? {}),
        ...(server.panelWidths ?? {}),
      };
      set({ panelWidths: merged, hydrated: true, loading: false });
      writeLocal(merged);
    } catch (err: unknown) {
      // Backend unreachable — keep whatever local cache we had.
      // Mark hydrated=true anyway so we don't retry on every render.
      console.warn("[ui-layout] backend hydrate failed, using local", err);
      set({ hydrated: true, loading: false });
    }
  },

  reset: () => {
    set({ panelWidths: undefined });
    writeLocal(undefined);
    void uiLayoutApi
      .patch({ panelWidths: {} })
      .catch((err: unknown) => {
        console.warn("[ui-layout] reset PATCH failed", err);
      });
  },
}));
