import { create } from "zustand";
import { uiLayoutApi } from "@/lib/ui-layout/client";

/**
 * Guided-tour state — which tours the user has seen.
 *
 * Persistence follows the ui-layout store's three-tier pattern:
 *   1. in-memory Zustand (active session),
 *   2. localStorage cache (instant reload restore, offline),
 *   3. backend `dismissed_tours` on `/user_preferences/ui_layout`
 *      (server truth — a new device never re-ambushes the user).
 *
 * Id conventions (opaque slugs, app-owned):
 *   - `welcome-intent-v1` — the welcome questions were answered/skipped.
 *   - `welcome-coach-v2` — the walkthrough was shown and closed (any way).
 *   - `welcome-coach-v2:completed` — the user clicked through to the end.
 *   - `welcome-tour-nudge-v1` — the nudge card was dismissed.
 * The `:completed` marker lets the NudgeCard re-offer a walkthrough the
 * user bailed out of without ever re-ambushing them with an auto-open.
 */

interface ToursState {
  dismissed: string[];
  hydrated: boolean;
  /**
   * True only after a successful backend sync. Nudges gate on this:
   * never offer a "dismiss forever" affordance when the dismissal
   * can't be durably persisted (and mocked e2e runs without a
   * preferences mock stay free of surprise overlays).
   */
  serverSynced: boolean;
  hydrate: () => Promise<void>;
  isDismissed: (tourId: string) => boolean;
  /** Record ids as seen — optimistic local write + fire-and-forget PATCH. */
  dismiss: (...tourIds: string[]) => void;
  /**
   * Durably un-dismiss ids (local + server) so a first-run flow can
   * replay — dev tooling only. Awaits the server PATCH because the
   * caller typically reloads right after; a fire-and-forget write
   * would race the reload and `hydrate` would union the stale server
   * list right back in.
   */
  undismiss: (...tourIds: string[]) => Promise<void>;
}

const LOCAL_STORAGE_KEY = "tours-v1";

function readLocal(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw == null || raw === "") return [];
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.every((x) => typeof x === "string")) {
      return parsed;
    }
  } catch (err) {
    console.warn("[tours] localStorage read failed", err);
  }
  return [];
}

function writeLocal(dismissed: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(dismissed));
  } catch (err) {
    console.warn("[tours] localStorage write failed", err);
  }
}

export const useToursStore = create<ToursState>((set, get) => ({
  dismissed: readLocal(),
  hydrated: false,
  serverSynced: false,

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const server = await uiLayoutApi.get();
      // Union of local + server: a dismissal recorded offline survives,
      // and a dismissal from another device is honored.
      const merged = Array.from(
        new Set([...get().dismissed, ...(server.dismissedTours ?? [])]),
      );
      set({ dismissed: merged, hydrated: true, serverSynced: true });
      writeLocal(merged);
    } catch (err: unknown) {
      // Backend unreachable — keep the local cache. Mark hydrated so we
      // don't refetch every render; worst case a tour re-offers on a
      // fresh device until the next successful sync.
      console.warn("[tours] backend hydrate failed, using local", err);
      set({ hydrated: true });
    }
  },

  isDismissed: (tourId) => get().dismissed.includes(tourId),

  dismiss: (...tourIds) => {
    const merged = Array.from(new Set([...get().dismissed, ...tourIds]));
    set({ dismissed: merged });
    writeLocal(merged);
    void uiLayoutApi.patch({ dismissedTours: merged }).catch((err: unknown) => {
      console.warn("[tours] dismiss PATCH failed", err);
    });
  },

  undismiss: async (...tourIds) => {
    const remaining = get().dismissed.filter((id) => !tourIds.includes(id));
    set({ dismissed: remaining });
    writeLocal(remaining);
    await uiLayoutApi.patch({ dismissedTours: remaining });
  },
}));
