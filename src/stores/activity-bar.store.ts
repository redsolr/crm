import { create } from "zustand";
import { uiLayoutApi } from "@/lib/ui-layout/client";

// ============================================================================
// Types
// ============================================================================

interface ViewPreference {
  visible: boolean;
}

interface ActivityBarState {
  views: Record<string, ViewPreference>;
  order: string[];
  /** True once the boot-time backend GET has reconciled (or failed). */
  hydrated: boolean;
  toggleVisibility: (viewId: string) => void;
  reorderViews: (newOrder: string[]) => void;
  resetDefaults: () => void;
  /** Pull the server-stored order/visibility and reconcile. Idempotent. */
  hydrate: () => Promise<void>;
}

// ============================================================================
// Constants
// ============================================================================

const STORAGE_KEY = "activity-bar-preferences";
const PATCH_DEBOUNCE_MS = 500;

// `label` is the full name (used in Settings → Customization and as the
// rail icon's hover tooltip). `rail` is the short, single-word caption shown
// UNDER the icon in the activity bar (Slack-style) — it must stay short
// enough to fit one line in the narrow rail without truncating.
export const ACTIVITY_BAR_VIEWS: Record<
  string,
  { label: string; rail: string }
> = {
  research: { label: "Research & Chat", rail: "Chat" },
  explorer: { label: "Matters", rail: "Matters" },
  summary: { label: "Management", rail: "Manage" },
  sales: { label: "Sales", rail: "Sales" },
  brief: { label: "Founder Brief", rail: "Brief" },
  "context-builder": { label: "Context Builder", rail: "Context" },
  personal: { label: "Personal", rail: "Personal" },
  team: { label: "Team", rail: "Team" },
  "knowledge-graph": { label: "Knowledge Graph", rail: "Graph" },
  "legal-library": { label: "Legal Library", rail: "Library" },
  "matter-templates": { label: "Matter Templates", rail: "Templates" },
  "firm-standards": { label: "Firm Standards", rail: "Standards" },
  "legal-workflows": { label: "Workflows", rail: "Workflows" },
  communications: { label: "Communications", rail: "Inbox" },
  "team-chat": { label: "Team Chat", rail: "Channels" },
};

export type ActivityBarViewId = keyof typeof ACTIVITY_BAR_VIEWS;

/**
 * The curated set of views pinned to the activity rail (Slack-style). Every
 * other view still ships, but surfaces inside the rail's "More" overflow
 * popover rather than as a top-level icon, so the rail stays uncluttered.
 * Reorder within the pinned set (or within More) is preserved via the shared
 * `order` array; this constant only decides which group a view falls into.
 */
export const ACTIVITY_BAR_PINNED: string[] = [
  "research", // Chat
  "communications", // Inbox
  "explorer", // Matters
  "team-chat", // Channels
  "summary", // Manage
  "matter-templates", // Templates
  "legal-library", // Library
];

export function isPinnedView(id: string): boolean {
  return ACTIVITY_BAR_PINNED.includes(id);
}

const DEFAULT_ORDER: string[] = Object.keys(ACTIVITY_BAR_VIEWS);

// ============================================================================
// Shape helpers
// ============================================================================

function getDefaults() {
  const views: Record<string, ViewPreference> = {};
  for (const id of DEFAULT_ORDER) {
    views[id] = { visible: true };
  }
  return { views, order: [...DEFAULT_ORDER] };
}

/**
 * Reconcile a raw saved/server `order` against the known view registry:
 * keep valid ids in their saved order, append any newly-shipped views
 * that weren't in the saved list, and drop ids that no longer exist.
 */
function normalizeOrder(saved: string[] | undefined): string[] {
  if (!saved) return [...DEFAULT_ORDER];
  const known = new Set(DEFAULT_ORDER);
  const valid = saved.filter((id) => known.has(id));
  const missing = DEFAULT_ORDER.filter((id) => !valid.includes(id));
  return [...valid, ...missing];
}

/** Build the `views` visibility map from a `hidden` id list. */
function viewsFromHidden(hidden: string[] | undefined): Record<string, ViewPreference> {
  const hiddenSet = new Set(hidden ?? []);
  const views: Record<string, ViewPreference> = {};
  for (const id of DEFAULT_ORDER) {
    views[id] = { visible: !hiddenSet.has(id) };
  }
  return views;
}

/** Inverse of `viewsFromHidden` — the ids the user has hidden. */
function hiddenFromViews(views: Record<string, ViewPreference>): string[] {
  return DEFAULT_ORDER.filter((id) => views[id]?.visible === false);
}

// ============================================================================
// localStorage cache (instant, same-browser; backend is authoritative across
// devices — mirrors the two-tier strategy in `ui-layout.store.ts`)
// ============================================================================

function loadFromStorage(): {
  views: Record<string, ViewPreference>;
  order: string[];
} {
  if (typeof window === "undefined") return getDefaults();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaults();

    const saved = JSON.parse(raw) as Record<string, unknown>;
    const defaults = getDefaults();

    const viewData =
      "views" in saved && typeof saved.views === "object"
        ? (saved.views as Record<string, unknown>)
        : {};
    const views: Record<string, ViewPreference> = { ...defaults.views };
    for (const [id, pref] of Object.entries(viewData)) {
      if (typeof pref === "object" && pref !== null && "visible" in pref) {
        views[id] = { visible: !!(pref as { visible: unknown }).visible };
      }
    }

    const order =
      "order" in saved && Array.isArray(saved.order)
        ? normalizeOrder(saved.order as string[])
        : [...DEFAULT_ORDER];

    return { views, order };
  } catch (err) {
    console.warn(
      "[stores/activity-bar] non-critical: failed to read view preferences from storage, falling back to defaults",
      err,
    );
    return getDefaults();
  }
}

function persistLocal(views: Record<string, ViewPreference>, order: string[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ views, order }));
  } catch {
    // localStorage unavailable — backend sync still covers persistence.
  }
}

// ============================================================================
// Backend sync — debounced so a flurry of drag steps coalesces into one PATCH
// ============================================================================

let patchTimer: ReturnType<typeof setTimeout> | null = null;

function schedulePatch(views: Record<string, ViewPreference>, order: string[]) {
  if (patchTimer != null) clearTimeout(patchTimer);
  patchTimer = setTimeout(() => {
    patchTimer = null;
    void uiLayoutApi
      .patch({ activityBar: { order, hidden: hiddenFromViews(views) } })
      .catch((err: unknown) => {
        // Fire-and-forget — the local experience already committed; a
        // failed sync just means cross-device is stale until the next write.
        console.warn("[stores/activity-bar] backend PATCH failed", err);
      });
  }, PATCH_DEBOUNCE_MS);
}

// ============================================================================
// Store
// ============================================================================

const initial = loadFromStorage();

export const useActivityBarStore = create<ActivityBarState>((set, get) => ({
  views: initial.views,
  order: initial.order,
  hydrated: false,

  toggleVisibility: (viewId: string) => {
    set((state) => {
      const current = state.views[viewId] ?? { visible: true };
      const views = { ...state.views, [viewId]: { visible: !current.visible } };
      persistLocal(views, state.order);
      schedulePatch(views, state.order);
      return { views };
    });
  },

  reorderViews: (newOrder: string[]) => {
    set((state) => {
      persistLocal(state.views, newOrder);
      schedulePatch(state.views, newOrder);
      return { order: newOrder };
    });
  },

  resetDefaults: () => {
    const defaults = getDefaults();
    persistLocal(defaults.views, defaults.order);
    schedulePatch(defaults.views, defaults.order);
    set(defaults);
  },

  hydrate: async () => {
    if (get().hydrated) return;
    try {
      const server = await uiLayoutApi.get();
      const ab = server.activityBar;
      // Only adopt server state when the user has actually stored
      // something; an empty/unset blob means "use whatever the local
      // cache / defaults already gave us" (never clobber local with
      // server defaults on a brand-new account).
      if (ab && (ab.order !== undefined || ab.hidden !== undefined)) {
        const order = normalizeOrder(ab.order);
        const views = viewsFromHidden(ab.hidden);
        persistLocal(views, order);
        set({ order, views, hydrated: true });
      } else {
        set({ hydrated: true });
      }
    } catch (err: unknown) {
      // Backend unreachable — keep the local cache. Mark hydrated so we
      // don't refire on every navigation.
      console.warn(
        "[stores/activity-bar] backend hydrate failed, using local cache",
        err,
      );
      set({ hydrated: true });
    }
  },
}));
