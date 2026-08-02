"use client";

/**
 * Record-page presence layer — the visible multiplayer on an open
 * record (opportunity/account detail):
 *
 *   - "viewing" pill: colleagues with this record open right now
 *   - live cursors: their pointers, relayed through the realtime room
 *     and rendered as colored arrows with name chips
 *   - cursor publishing: this client's pointer, normalized to the
 *     layer's box (throttled; an explicit "left" signal on mouse-out)
 *
 * Mount INSIDE the record page's root container and make that root
 * `relative` — the overlay is `absolute inset-0` and pointer-events
 * transparent, so it never eats clicks. Renders nothing at all when
 * realtime is off or you're alone.
 */

import { useEffect, useRef } from "react";
import {
  useRealtimeStore,
  type RealtimeCursor,
  type RealtimePeer,
} from "@/lib/realtime/realtime-store";
import { useOthers } from "@/lib/realtime/use-others";

const CURSOR_THROTTLE_MS = 40;

export function RecordPresenceLayer({ recordId }: { recordId: string }) {
  const others = useOthers();
  const cursors = useRealtimeStore((s) => s.cursors);
  const overlayRef = useRef<HTMLDivElement>(null);

  const viewers = others.filter((p) => p.view?.recordId === recordId);
  const recordCursors = Object.values(cursors).filter(
    (c) => c.recordId === recordId,
  );

  // Publish this client's pointer from the parent container's events.
  useEffect(() => {
    const overlay = overlayRef.current;
    const parent = overlay?.parentElement;
    if (!overlay || !parent) return;

    let lastSent = 0;
    const onMove = (event: MouseEvent) => {
      const now = Date.now();
      if (now - lastSent < CURSOR_THROTTLE_MS) return;
      lastSent = now;
      const send = useRealtimeStore.getState().send;
      if (send === null) return;
      const box = parent.getBoundingClientRect();
      if (box.width === 0 || box.height === 0) return;
      send({
        type: "cursor",
        recordId,
        x: (event.clientX - box.left) / box.width,
        y: (event.clientY - box.top) / box.height,
      });
    };
    const onLeave = () => {
      // Negative x = explicit "cursor left" (peers drop it immediately
      // instead of waiting out the staleness sweep).
      useRealtimeStore.getState().send?.({
        type: "cursor",
        recordId,
        x: -1,
        y: -1,
      });
    };

    parent.addEventListener("mousemove", onMove);
    parent.addEventListener("mouseleave", onLeave);
    return () => {
      parent.removeEventListener("mousemove", onMove);
      parent.removeEventListener("mouseleave", onLeave);
    };
  }, [recordId]);

  return (
    <>
      {viewers.length > 0 && <ViewingPill viewers={viewers} />}
      <div
        ref={overlayRef}
        className="record-presence-layer pointer-events-none absolute inset-0 overflow-hidden"
        data-testid="record-presence-layer"
        aria-hidden
      >
        {recordCursors.map((cursor) => (
          <PeerCursor key={cursor.peerId} cursor={cursor} />
        ))}
      </div>
    </>
  );
}

/** "Nan is here" — colleagues with this record open. */
function ViewingPill({ viewers }: { viewers: RealtimePeer[] }) {
  return (
    <div
      className="record-viewing-pill absolute right-4 top-3 z-20 flex items-center gap-1.5 rounded-full border border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)] px-2.5 py-1"
      data-testid="record-viewing-pill"
    >
      {viewers.map((peer) => (
        <span key={peer.id} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: peer.color }}
            aria-hidden
          />
          <span className="text-xs text-[var(--theme-text-secondary)]">
            {peer.name} is here
          </span>
        </span>
      ))}
    </div>
  );
}

function PeerCursor({ cursor }: { cursor: RealtimeCursor }) {
  return (
    <div
      className="peer-cursor absolute z-30 transition-[left,top] duration-75 ease-linear"
      data-testid="peer-cursor"
      style={{ left: `${cursor.x * 100}%`, top: `${cursor.y * 100}%` }}
    >
      <svg
        width="14"
        height="18"
        viewBox="0 0 14 18"
        fill="none"
        style={{ display: "block" }}
        aria-hidden
      >
        <path
          d="M1 1l5.5 15 2.2-6.3L15 7.5 1 1z"
          fill={cursor.color}
          stroke="white"
          strokeWidth="1"
        />
      </svg>
      <span
        className="peer-cursor-name ml-2 inline-block whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
        style={{ backgroundColor: cursor.color }}
      >
        {cursor.name}
      </span>
    </div>
  );
}
