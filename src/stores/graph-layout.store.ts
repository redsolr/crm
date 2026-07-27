"use client";

import { create } from "zustand";
import { knowledgeGraphApi } from "@/lib/knowledge-graph/client";
import type {
  GraphLayoutScope,
  GraphLayoutScopeRef,
  GraphPositions,
  NodePosition,
} from "@/lib/knowledge-graph/schemas";

/**
 * Per-user, per-scope overrides of knowledge-graph node positions.
 *
 * The store is keyed by `${scopeType}:${scopeId}` so a user can
 * switch between project and organization layouts without losing
 * work on either — each scope keeps its own position map cached in
 * memory. On first visit to a scope we fetch the server copy once;
 * subsequent drags hit the local copy synchronously and a 500ms
 * debounced PATCH pushes the diff to the backend.
 *
 * localStorage mirrors the in-memory state keyed on
 * `${userId}:${scopeKey}` so a reload doesn't flash force-atlas
 * positions before the network hydrates — same two-tier pattern
 * `ui-layout.store.ts` uses for panel widths.
 *
 * Why not react-query: drags are high-frequency writes (one per
 * drop, up to a few per second) and the "source of truth" for the
 * session is the in-memory positions map, not the server. TanStack
 * Query is optimised for request/response data; this is closer to
 * a local first-class state.
 */

const DEBOUNCE_MS = 500;
const LOCAL_STORAGE_PREFIX = "kg-layout-v1";

export function scopeKey(ref: GraphLayoutScopeRef): string {
  return `${ref.scopeType}:${ref.scopeId}`;
}

const EMPTY_POSITIONS: GraphPositions = Object.freeze({});

interface ScopeState {
  positions: GraphPositions;
  hydrated: boolean;
  loading: boolean;
}

// ── Reusable selectors ──────────────────────────────────────────────────

/**
 * Positions map for whichever scope is currently active. Returns
 * a frozen empty object (stable identity) when no scope is active
 * so effects keyed on this value don't re-run on every render.
 */
export function selectActivePositions(state: GraphLayoutState): GraphPositions {
  if (state.activeScope == null) return EMPTY_POSITIONS;
  return (
    state.byScope[scopeKey(state.activeScope)]?.positions ?? EMPTY_POSITIONS
  );
}

/** Count of pinned (user-dragged) nodes in the active scope. */
export function selectPinnedCount(state: GraphLayoutState): number {
  return Object.keys(selectActivePositions(state)).length;
}

/** Whether a specific node has a saved override in the active scope. */
export function selectIsNodePinned(
  nodeId: string | null | undefined,
): (state: GraphLayoutState) => boolean {
  return (state) => {
    if (nodeId == null) return false;
    return nodeId in selectActivePositions(state);
  };
}

interface GraphLayoutState {
  byScope: Record<string, ScopeState>;
  /** Scope currently driving the canvas. Consumer (GraphCanvas) calls
   *  `setActiveScope` whenever the URL filters change or the user
   *  toggles between project and organization scope. */
  activeScope: GraphLayoutScopeRef | null;
  /** User's preferred scope type — reused across sessions so the
   *  canvas defaults to the right choice without making the user
   *  re-pick every visit. */
  preferredScope: GraphLayoutScope;

  setActiveScope: (scope: GraphLayoutScopeRef | null) => Promise<void>;
  setPreferredScope: (scope: GraphLayoutScope) => void;
  getActivePositions: () => GraphPositions;
  setNodePosition: (nodeId: string, pos: NodePosition) => void;
  removeNodePosition: (nodeId: string) => Promise<void>;
  clearActiveLayout: () => Promise<void>;
}

// ── localStorage helpers ────────────────────────────────────────────────

function readLocal(key: string): GraphPositions | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}:${key}`);
    if (raw == null || raw === "") return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed as GraphPositions;
  } catch (err) {
    console.warn("[kg-layout] local read failed", err);
    return null;
  }
}

function writeLocal(key: string, positions: GraphPositions): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      `${LOCAL_STORAGE_PREFIX}:${key}`,
      JSON.stringify(positions),
    );
  } catch (err) {
    console.warn("[kg-layout] local write failed", err);
  }
}

function readPreferred(): GraphLayoutScope {
  if (typeof window === "undefined") return "project";
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_PREFIX}:preferred`);
    if (raw === "project" || raw === "organization") return raw;
  } catch (err) {
    console.warn("[kg-layout] preferred read failed", err);
  }
  return "project";
}

function writePreferred(scope: GraphLayoutScope): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${LOCAL_STORAGE_PREFIX}:preferred`, scope);
  } catch (err) {
    console.warn("[kg-layout] preferred write failed", err);
  }
}

// ── Debounce accumulator ────────────────────────────────────────────────

/**
 * Staged writes keyed by scope, holding nodes touched since the
 * last flush. A new drag on node N overwrites any pending value
 * for N — only the latest position ever reaches the server, so we
 * never PATCH the same node twice with stale intermediate values.
 *
 * Module scope (not part of Zustand state) because the timer + map
 * are purely transport concerns — they shouldn't trigger renders
 * when the user drags.
 */
const pendingByScope = new Map<string, GraphPositions>();
const flushTimers = new Map<string, ReturnType<typeof setTimeout>>();

function schedulePatch(scope: GraphLayoutScopeRef): void {
  const key = scopeKey(scope);
  const existing = flushTimers.get(key);
  if (existing != null) clearTimeout(existing);
  const timer = setTimeout(() => {
    flushTimers.delete(key);
    void flushPatch(scope);
  }, DEBOUNCE_MS);
  flushTimers.set(key, timer);
}

async function flushPatch(scope: GraphLayoutScopeRef): Promise<void> {
  const key = scopeKey(scope);
  const pending = pendingByScope.get(key);
  if (pending == null || Object.keys(pending).length === 0) return;
  pendingByScope.delete(key);
  try {
    await knowledgeGraphApi.patchLayout(scope, pending);
  } catch (err) {
    console.warn("[kg-layout] PATCH failed, re-queueing", err);
    // Merge back into pending so the next drag triggers a retry.
    // Avoid clobbering any drags that landed during the in-flight
    // request — server is the eventual source of truth.
    const stillPending = pendingByScope.get(key) ?? {};
    pendingByScope.set(key, { ...pending, ...stillPending });
  }
}

// ── Store ───────────────────────────────────────────────────────────────

export const useGraphLayoutStore = create<GraphLayoutState>((set, get) => ({
  byScope: {},
  activeScope: null,
  preferredScope: readPreferred(),

  setActiveScope: async (scope) => {
    set({ activeScope: scope });
    if (scope == null) return;
    const key = scopeKey(scope);
    const existing = get().byScope[key];
    if (existing?.hydrated === true) return;

    // Seed with localStorage for an instant paint — server fetch
    // backfills in the background and wins if values differ.
    const cached = readLocal(key) ?? {};
    set((s) => ({
      byScope: {
        ...s.byScope,
        [key]: {
          positions: cached,
          hydrated: false,
          loading: true,
        },
      },
    }));

    try {
      const response = await knowledgeGraphApi.getLayout(scope);
      set((s) => ({
        byScope: {
          ...s.byScope,
          [key]: {
            positions: response.positions,
            hydrated: true,
            loading: false,
          },
        },
      }));
      writeLocal(key, response.positions);
    } catch (err) {
      console.warn("[kg-layout] hydrate failed, using local cache", err);
      set((s) => ({
        byScope: {
          ...s.byScope,
          [key]: {
            positions: cached,
            hydrated: true,
            loading: false,
          },
        },
      }));
    }
  },

  setPreferredScope: (scope) => {
    set({ preferredScope: scope });
    writePreferred(scope);
  },

  getActivePositions: () => selectActivePositions(get()),

  setNodePosition: (nodeId, pos) => {
    const scope = get().activeScope;
    if (scope == null) return;
    const key = scopeKey(scope);

    set((s) => {
      const prev = s.byScope[key]?.positions ?? {};
      const nextPositions: GraphPositions = { ...prev, [nodeId]: pos };
      const nextScopeState: ScopeState = {
        positions: nextPositions,
        hydrated: s.byScope[key]?.hydrated ?? false,
        loading: s.byScope[key]?.loading ?? false,
      };
      writeLocal(key, nextPositions);
      return {
        byScope: { ...s.byScope, [key]: nextScopeState },
      };
    });

    // Stage for the next debounced flush.
    const currentPending = pendingByScope.get(key) ?? {};
    pendingByScope.set(key, { ...currentPending, [nodeId]: pos });
    schedulePatch(scope);
  },

  removeNodePosition: async (nodeId) => {
    const scope = get().activeScope;
    if (scope == null) return;
    const key = scopeKey(scope);

    // Drop any pending write for this node — the upcoming DELETE
    // supersedes it. If no pending entries remain, cancel the
    // flush timer too.
    const pending = pendingByScope.get(key);
    if (pending != null && nodeId in pending) {
      const { [nodeId]: _dropped, ...rest } = pending;
      if (Object.keys(rest).length === 0) {
        pendingByScope.delete(key);
        const timer = flushTimers.get(key);
        if (timer != null) clearTimeout(timer);
        flushTimers.delete(key);
      } else {
        pendingByScope.set(key, rest);
      }
    }

    set((s) => {
      const prev = s.byScope[key]?.positions ?? {};
      const { [nodeId]: _dropped, ...rest } = prev;
      const nextPositions = rest as GraphPositions;
      writeLocal(key, nextPositions);
      return {
        byScope: {
          ...s.byScope,
          [key]: {
            positions: nextPositions,
            hydrated: s.byScope[key]?.hydrated ?? false,
            loading: s.byScope[key]?.loading ?? false,
          },
        },
      };
    });

    try {
      await knowledgeGraphApi.clearLayoutNode(scope, nodeId);
    } catch (err) {
      console.warn("[kg-layout] clearLayoutNode failed", err);
    }
  },

  clearActiveLayout: async () => {
    const scope = get().activeScope;
    if (scope == null) return;
    const key = scopeKey(scope);

    // Cancel any pending patch — the upcoming DELETE supersedes it.
    const timer = flushTimers.get(key);
    if (timer != null) clearTimeout(timer);
    flushTimers.delete(key);
    pendingByScope.delete(key);

    set((s) => ({
      byScope: {
        ...s.byScope,
        [key]: { positions: {}, hydrated: true, loading: false },
      },
    }));
    writeLocal(key, {});

    try {
      await knowledgeGraphApi.clearLayout(scope);
    } catch (err) {
      console.warn("[kg-layout] clear failed", err);
    }
  },
}));
