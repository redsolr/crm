"use client";

/**
 * Colleagues other than me, render-derived from stable store slices —
 * the ONE sanctioned way for components to read the roster (a direct
 * `useRealtimeStore(selectOthers)` allocates per snapshot and loops
 * React's getSnapshot; see realtime-store.ts).
 */

import { useRealtimeStore, type RealtimePeer } from "./realtime-store";

export function useOthers(): RealtimePeer[] {
  const peers = useRealtimeStore((s) => s.peers);
  const selfId = useRealtimeStore((s) => s.session?.self.id ?? null);
  return selfId === null ? peers : peers.filter((p) => p.id !== selfId);
}
