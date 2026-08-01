"use client";

/**
 * Realtime connection lifecycle — mounted ONCE in `CrmShell`.
 *
 * Boot: `GET /api/realtime/session`. A 204 means the worker isn't
 * configured — the hook goes dormant and the app behaves exactly as
 * before (refresh-to-see-changes). Otherwise it opens the WebSocket
 * and keeps it alive:
 *
 *   - reconnect with capped exponential backoff (fresh token each try)
 *   - keepalive ping every 30s (answered by the DO's auto-responder
 *     without waking it)
 *   - publishes `view` (route + open record + focused field) whenever
 *     navigation or field focus changes
 *   - `invalidate` → refetch the record/sales queries (cross-user
 *     cache invalidation, deferred row 23 item 1)
 *   - `presence` / `cursor` → realtime store (avatars, pills, cursors)
 */

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/queries/query-keys";
import {
  useRealtimeStore,
  type RealtimeCursor,
  type RealtimePeer,
} from "./realtime-store";

const PING_INTERVAL_MS = 30_000;
const MAX_BACKOFF_MS = 30_000;
const CURSOR_TTL_MS = 4_000;

/** `/sales/opportunity/:id` and `/sales/account/:id` are the record
 *  pages presence points at. */
export function recordIdFromPath(path: string): string | null {
  const match = /^\/sales\/(?:opportunity|account)\/([^/?#]+)/.exec(path);
  return match?.[1] ?? null;
}

/** Module-level focus state: field editors call `publishFieldFocus`,
 *  the connection folds it into the next `view` message. */
let currentFieldKey: string | null = null;
let viewPublisher: (() => void) | null = null;

export function publishFieldFocus(fieldKey: string | null): void {
  currentFieldKey = fieldKey;
  viewPublisher?.();
}

export function useRealtimeConnection(): void {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;

  // ── Socket lifecycle (mount once) ─────────────────────────────────
  useEffect(() => {
    const store = useRealtimeStore.getState();
    let socket: WebSocket | null = null;
    let disposed = false;
    let backoff = 1_000;
    let pingTimer: ReturnType<typeof setInterval> | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let cursorSweep: ReturnType<typeof setInterval> | null = null;

    const sendView = () => {
      if (socket?.readyState !== WebSocket.OPEN) return;
      const path = pathnameRef.current ?? "/";
      socket.send(
        JSON.stringify({
          type: "view",
          view: {
            path,
            recordId: recordIdFromPath(path),
            fieldKey: currentFieldKey,
          },
        }),
      );
    };
    viewPublisher = sendView;

    const connect = async () => {
      if (disposed) return;
      try {
        const res = await fetch("/api/realtime/session");
        if (!res.ok || res.status === 204) {
          // 204 = feature off; any other non-200 means this deployment
          // doesn't serve realtime (e.g. the mocked e2e tier answers
          // unrouted /api calls with 599). Either way: dormant, no
          // retry loop. Only NETWORK failures (fetch rejection) retry.
          store.setStatus("off");
          return;
        }
        const session = (await res.json()) as {
          url: string;
          self: { id: string; name: string | null; email: string | null };
        };
        store.setSelfId(session.self.id);
        store.setStatus("connecting");

        socket = new WebSocket(session.url);
        socket.onopen = () => {
          backoff = 1_000;
          useRealtimeStore.getState().setStatus("on");
          useRealtimeStore.getState().setSend((message) => {
            if (socket?.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify(message));
            }
          });
          sendView();
        };
        socket.onmessage = (event: MessageEvent<string>) => {
          let data: {
            type?: string;
            peers?: RealtimePeer[];
            peer?: { id: string; name: string; color: string };
            recordId?: string;
            x?: number;
            y?: number;
          };
          try {
            data = JSON.parse(event.data) as typeof data;
          } catch {
            return;
          }
          const s = useRealtimeStore.getState();
          if (data.type === "presence" && Array.isArray(data.peers)) {
            s.setPeers(data.peers);
          } else if (data.type === "cursor" && data.peer) {
            if (
              typeof data.x === "number" &&
              data.x >= 0 &&
              typeof data.y === "number" &&
              typeof data.recordId === "string"
            ) {
              s.upsertCursor({
                peerId: data.peer.id,
                name: data.peer.name,
                color: data.peer.color,
                recordId: data.recordId,
                x: data.x,
                y: data.y,
                at: Date.now(),
              } satisfies RealtimeCursor);
            } else {
              // Negative x = explicit "cursor left" signal.
              s.removeCursor(data.peer.id);
            }
          } else if (data.type === "invalidate") {
            void queryClient.invalidateQueries({
              queryKey: queryKeys.workItems.all,
            });
            void queryClient.invalidateQueries({
              queryKey: queryKeys.sales.all,
            });
          }
        };
        socket.onclose = () => {
          useRealtimeStore.getState().setSend(null);
          useRealtimeStore.getState().setPeers([]);
          if (disposed) return;
          useRealtimeStore.getState().setStatus("connecting");
          reconnectTimer = setTimeout(() => void connect(), backoff);
          backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
        };
        socket.onerror = () => {
          socket?.close();
        };
      } catch (err) {
        console.warn("[realtime] connect failed — retrying:", err);
        if (!disposed) {
          reconnectTimer = setTimeout(() => void connect(), backoff);
          backoff = Math.min(backoff * 2, MAX_BACKOFF_MS);
        }
      }
    };

    void connect();

    pingTimer = setInterval(() => {
      if (socket?.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ping" }));
      }
    }, PING_INTERVAL_MS);

    // Prune cursors that stopped updating (peer left / stopped moving).
    cursorSweep = setInterval(() => {
      const s = useRealtimeStore.getState();
      const now = Date.now();
      for (const cursor of Object.values(s.cursors)) {
        if (now - cursor.at > CURSOR_TTL_MS) s.removeCursor(cursor.peerId);
      }
    }, 2_000);

    return () => {
      disposed = true;
      viewPublisher = null;
      currentFieldKey = null;
      if (pingTimer) clearInterval(pingTimer);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (cursorSweep) clearInterval(cursorSweep);
      socket?.close();
      useRealtimeStore.getState().reset();
    };
    // Effectively mount-once: `queryClient` is a stable singleton and
    // navigation rides the view effect below via `pathnameRef`.
  }, [queryClient]);

  // ── Publish view on navigation ────────────────────────────────────
  useEffect(() => {
    currentFieldKey = null; // navigating away drops any field claim
    viewPublisher?.();
  }, [pathname]);
}
