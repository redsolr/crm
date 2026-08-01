"use client";

/**
 * Client half of the realtime collaboration channel (worker:
 * `realtime/`, server: `src/server/realtime.ts`, lifecycle:
 * `use-realtime-connection.ts`).
 *
 * One Zustand store holds everything the UI renders:
 *   - `peers`      — everyone else online (with which record/field
 *                    they're on) → avatar stack, "viewing" pill,
 *                    field-claim rings
 *   - `cursors`    — live pointers relayed for the record page you
 *                    have open (ephemeral, pruned on staleness)
 *   - `send`       — the connection's outbound channel, installed by
 *                    the lifecycle hook so leaf components (cursor
 *                    layer, field editors) can publish without prop
 *                    threading
 *
 * Everything here is client-only UI state — server data stays in
 * TanStack Query (store pattern, CLAUDE.md).
 */

import { create } from "zustand";

export interface RealtimePeerView {
  path: string;
  recordId: string | null;
  fieldKey: string | null;
}

export interface RealtimePeer {
  id: string;
  name: string;
  email: string | null;
  color: string;
  view: RealtimePeerView | null;
}

export interface RealtimeCursor {
  peerId: string;
  name: string;
  color: string;
  recordId: string;
  /** Normalized [0..1] within the record page's presence layer. */
  x: number;
  y: number;
  at: number;
}

interface RealtimeState {
  status: "off" | "connecting" | "on";
  selfId: string | null;
  peers: RealtimePeer[];
  /** peerId → latest cursor (already filtered to others). */
  cursors: Record<string, RealtimeCursor>;
  send: ((message: Record<string, unknown>) => void) | null;

  setStatus: (status: RealtimeState["status"]) => void;
  setSelfId: (id: string | null) => void;
  setPeers: (peers: RealtimePeer[]) => void;
  upsertCursor: (cursor: RealtimeCursor) => void;
  removeCursor: (peerId: string) => void;
  setSend: (send: RealtimeState["send"]) => void;
  reset: () => void;
}

export const useRealtimeStore = create<RealtimeState>((set) => ({
  status: "off",
  selfId: null,
  peers: [],
  cursors: {},
  send: null,

  setStatus: (status) => set({ status }),
  setSelfId: (selfId) => set({ selfId }),
  setPeers: (peers) => set({ peers }),
  upsertCursor: (cursor) =>
    set((s) => ({ cursors: { ...s.cursors, [cursor.peerId]: cursor } })),
  removeCursor: (peerId) =>
    set((s) => {
      if (!(peerId in s.cursors)) return s;
      const next = { ...s.cursors };
      delete next[peerId];
      return { cursors: next };
    }),
  setSend: (send) => set({ send }),
  reset: () => set({ status: "off", peers: [], cursors: {}, send: null }),
}));

/**
 * Peers other than me (presence roster excludes self for rendering).
 *
 * NOT for direct use as a `useRealtimeStore(selectOthers)` selector —
 * it allocates a fresh array per call, which loops React's
 * `getSnapshot`. Select `peers` + `selfId` and derive (memoized or
 * in-render), or use it inside a selector whose RETURN value is
 * referentially stable (e.g. `.find`).
 */
export function selectOthers(s: RealtimeState): RealtimePeer[] {
  return s.selfId === null ? s.peers : s.peers.filter((p) => p.id !== s.selfId);
}
