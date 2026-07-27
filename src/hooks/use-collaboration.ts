"use client";

import { useEffect, useState, useMemo } from "react";
import { HocuspocusProvider } from "@hocuspocus/provider";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import { authService } from "@/lib/authTokenManager";
import { API_BASE } from "@/lib/api-base";
import { useAuthStore } from "@/stores/auth.store";
import { stringToHue } from "@/lib/identity";

export interface CollaborationUser {
  name: string;
  color: string;
}

export interface UseCollaborationOptions {
  /** Page ID to collaborate on */
  pageId: string | null;
  /** Whether collaboration is enabled (default: true) */
  enabled?: boolean;
}

export interface UseCollaborationReturn {
  /** The Yjs document — pass to Tiptap Collaboration extension */
  ydoc: Y.Doc | null;
  /** The Hocuspocus provider — pass to CollaborationCursor extension */
  provider: HocuspocusProvider | null;
  /** Whether the document is synced with the server */
  isSynced: boolean;
  /** Whether the provider is connected */
  isConnected: boolean;
  /** Current user info for awareness */
  currentUser: CollaborationUser;
  /** Number of connected collaborators (including self) */
  connectedUsers: number;
  /** List of all connected users (from awareness protocol) */
  collaborators: CollaborationUser[];
  /**
   * True when collaboration could not be established for this page
   * (ticket/auth failed, or the websocket never connected within the
   * grace window). The provider/ydoc are torn down so the editor falls
   * back to single-editor mode (initialContent + REST autosave) instead
   * of rendering an empty Yjs doc. Deliberately sticky for the page
   * session — no flip-flopping back into collab mid-edit, which would
   * risk duplicate-merge on late sync.
   */
  collabUnavailable: boolean;
  /**
   * True when the platform authorized this connection read-only (a
   * viewer/commenter share grant, or an org `readonly` role — see
   * `CollaborationService.authorizePage`). The editor must set
   * `editable=false` for this, not merely hide toolbar buttons: the
   * server drops document writes from a read-only connection, so an
   * editable UI here would silently lose keystrokes.
   */
  readOnly: boolean;
}

/**
 * How long a provider may sit never-connected before we give up and
 * fall back to single-editor mode. Reconnects AFTER a successful first
 * connection never trigger this — Yjs + IndexedDB handle transient
 * drops offline-first.
 */
const CONNECT_GRACE_MS = 8000;

/**
 * HSL → 6-digit hex. `@tiptap/y-tiptap`'s cursor-decoration renderer
 * validates `awareness.user.color` against a hex-only regex and silently
 * falls back to a shared orange for anything else (confirmed via its
 * `rxValidColor` check) — CSS `hsl(...)`, otherwise fine as a
 * `background-color` value, is NOT accepted here.
 */
function hslToHex(h: number, s: number, l: number): string {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) =>
    lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  const toHex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

/** Deterministic per-user color, same identity-hash as the presence avatar stack (`stringToHue`). */
function stringToColor(str: string): string {
  return hslToHex(stringToHue(str), 55, 48);
}

/** Build the WebSocket URL from the API base URL */
function getWebSocketUrl(): string {
  const base = API_BASE.replace(/\/api$/, ""); // Strip /api suffix if present
  const wsProtocol = base.startsWith("https") ? "wss" : "ws";
  const host = base.replace(/^https?:\/\//, "");
  return `${wsProtocol}://${host}/collaboration`;
}

export function useCollaboration({
  pageId,
  enabled = true,
}: UseCollaborationOptions): UseCollaborationReturn {
  const user = useAuthStore((s) => s.user);
  // ydoc + provider are state, not refs, so consumers (Tiptap
  // extensions) re-render when they're created/destroyed. Reading
  // refs during render trips `react-hooks/refs`; state-tracked
  // values flow through React's render model cleanly.
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [isSynced, setIsSynced] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState(0);
  const [collaborators, setCollaborators] = useState<CollaborationUser[]>([]);
  const [collabUnavailable, setCollabUnavailable] = useState(false);
  const [readOnly, setReadOnly] = useState(false);

  // A new page gets a fresh chance at collaboration. Adjust during render
  // (React recipe) rather than an effect (react-hooks/set-state-in-effect).
  const [prevPageId, setPrevPageId] = useState(pageId);
  if (prevPageId !== pageId) {
    setPrevPageId(pageId);
    setCollabUnavailable(false);
    setReadOnly(false);
  }

  const currentUser = useMemo<CollaborationUser>(
    () => ({
      name: user?.full_name || user?.email || "Anonymous",
      color: stringToColor(user?.user_id || "anonymous"),
    }),
    [user?.full_name, user?.email, user?.user_id],
  );

  useEffect(() => {
    if (!pageId || !enabled || collabUnavailable) {
      return;
    }

    // Give up if the provider NEVER connects (collab server down /
    // unreachable / auth rejected) — the editor then falls back to
    // single-editor mode instead of showing an empty Yjs doc forever.
    let everConnected = false;
    const giveUpTimer = window.setTimeout(() => {
      if (!everConnected) {
        console.warn(
          `[use-collaboration] never connected for ${pageId} within ` +
            `${CONNECT_GRACE_MS}ms — falling back to single-editor mode`,
        );
        setCollabUnavailable(true);
      }
    }, CONNECT_GRACE_MS);

    const localYdoc = new Y.Doc();
    // Push the ydoc/provider into React state in a microtask so the
    // setState that lands isn't classified as "synchronously called
    // from the effect body" by the React compiler. Tiptap is fine
    // with the one-tick gap — collaboration extensions guard for
    // null on prop transitions.
    const flushId = window.setTimeout(() => {
      setYdoc(localYdoc);
      setProvider(localProvider);
    }, 0);

    // Offline persistence: loads cached Y.Doc from IndexedDB immediately,
    // then merges with server state when WebSocket connects.
    // Edits made offline are preserved and sync on reconnect.
    const idb = new IndexeddbPersistence(`page:${pageId}`, localYdoc);
    let idbSynced = false;
    idb.once("synced", () => {
      idbSynced = true;
    });

    const localProvider = new HocuspocusProvider({
      url: getWebSocketUrl(),
      name: `page:${pageId}`,
      document: localYdoc,
      // Browsers can't read HttpOnly cookies from JS and can't set
      // `Authorization` headers on a `new WebSocket()`, so we mint a
      // single-use ticket from the cookie-authed REST surface and
      // hand that to Hocuspocus instead. The BE's `WsTicketService`
      // consumes the ticket atomically (Redis GETDEL) on the auth
      // callback. Provider re-calls this resolver on reconnect, so
      // each reconnect gets a fresh 60-second ticket.
      token: async () => {
        try {
          const csrf = authService.getCsrfToken();
          const headers: Record<string, string> = {};
          if (csrf !== null) headers["X-CSRF-Token"] = csrf;
          const res = await fetch(`${API_BASE}/auth/ws_ticket`, {
            method: "POST",
            credentials: "include",
            headers,
          });
          if (!res.ok) {
            // No ticket → no possible collab session. Fall back to
            // single-editor mode IMMEDIATELY (don't burn the grace
            // window on a websocket that can only be rejected).
            console.error(
              "[use-collaboration] /auth/ws_ticket failed — falling back " +
                "to single-editor mode:",
              res.status,
            );
            setCollabUnavailable(true);
            return "";
          }
          const data = (await res.json()) as { ticket: string };
          return data.ticket;
        } catch (err) {
          console.error(
            "[use-collaboration] /auth/ws_ticket threw — falling back to " +
              "single-editor mode:",
            err,
          );
          setCollabUnavailable(true);
          return "";
        }
      },

      onSynced: () => {
        setIsSynced(true);
      },

      // The server stamps `connectionConfig.readOnly` from the page's
      // access rules (owner / share grant / org role — see
      // `CollaborationService.authorizePage`) and reports it back as
      // the authorized scope. `readonly` here means the server WILL
      // drop document writes from this connection, so the editor must
      // reflect it as `editable=false`, not just hide save buttons.
      onAuthenticated: ({ scope }) => {
        setReadOnly(scope === "readonly");
      },

      onStatus: ({ status }) => {
        if (status === "connected") everConnected = true;
        setIsConnected(status === "connected");
      },

      onAuthenticationFailed: ({ reason }) => {
        // A rejected ticket won't fix itself by retrying — fall back to
        // single-editor mode immediately rather than waiting out the
        // grace window on a doomed connection.
        console.error(
          "[Collaboration] Auth failed — falling back to single-editor mode:",
          reason,
        );
        setCollabUnavailable(true);
      },

      onAwarenessChange: ({ states }) => {
        setConnectedUsers(states.length);
        const users: CollaborationUser[] = [];
        for (const state of states) {
          const user = (state as Record<string, unknown>).user as
            | CollaborationUser
            | undefined;
          if (user?.name) users.push(user);
        }
        setCollaborators(users);
      },
    });

    // Set initial awareness state
    localProvider.setAwarenessField("user", currentUser);

    return () => {
      window.clearTimeout(flushId);
      window.clearTimeout(giveUpTimer);
      // Null the consumer-facing state FIRST and destroy on a macrotask:
      // a consumer (Tiptap) re-rendering in the same commit may still
      // hold the old provider in its extension options for one frame —
      // destroying synchronously here made CollaborationCursor's
      // decoration init read a torn-down awareness (`undefined.doc`).
      setProvider(null);
      setYdoc(null);
      setIsSynced(false);
      setIsConnected(false);
      setConnectedUsers(0);
      setCollaborators([]);
      setReadOnly(false);
      window.setTimeout(() => {
        localProvider.destroy();
        // Guard against y-indexeddb destroy race condition (issue #20).
        // If synced event never fires (e.g. IndexedDB unavailable),
        // the timeout ensures cleanup after 5 seconds.
        if (idbSynced) {
          idb.destroy();
        } else {
          const timeout = setTimeout(() => idb.destroy(), 5000);
          idb.once("synced", () => {
            clearTimeout(timeout);
            idb.destroy();
          });
        }
        localYdoc.destroy();
      }, 0);
    };
  }, [pageId, enabled, currentUser, collabUnavailable]);

  return {
    ydoc,
    provider,
    isSynced,
    isConnected,
    currentUser,
    connectedUsers,
    collaborators,
    collabUnavailable,
    readOnly,
  };
}
