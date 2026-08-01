/**
 * crm-realtime — WebSocket collaboration worker for the standalone CRM.
 *
 * One Durable Object room per workspace carries three message families:
 *
 *   presence    — who is online and which record they are viewing
 *                 (roster re-broadcast on join / leave / view change)
 *   cursor      — live pointer relay on record pages (never stored)
 *   invalidate  — server-to-server "data changed" fan-out: the CRM's
 *                 write paths POST /broadcast and every connected
 *                 client refetches its queries
 *
 * Auth: browser sockets carry a short-lived HMAC token minted by the
 * CRM (`GET /api/realtime/session`); the /broadcast endpoint uses the
 * shared secret directly (server-to-server). Same secret both ways
 * (`REALTIME_SECRET`).
 *
 * Uses the WebSocket Hibernation API — sockets survive DO eviction and
 * an idle room costs nothing. Per-socket identity rides
 * serializeAttachment (restored after hibernation).
 */

import { DurableObject } from "cloudflare:workers";

export interface Env {
  ROOM: DurableObjectNamespace<CrmRoom>;
  REALTIME_SECRET: string;
}

interface RealtimeUser {
  id: string;
  name: string;
  email: string | null;
  color: string;
}

interface SocketAttachment {
  user: RealtimeUser;
  /** Where the peer is: route, open record, and (while editing) which
   *  attribute field they hold focus on — drives the field-claim ring. */
  view: { path: string; recordId: string | null; fieldKey: string | null } | null;
}

/** Peer colors — assigned deterministically from the user id so every
 *  client renders the same person in the same hue. */
const PEER_COLORS = [
  "#6E9BFF", // blue
  "#F59E0B", // amber
  "#34D399", // green
  "#F472B6", // pink
  "#A78BFA", // violet
  "#F87171", // red
  "#22D3EE", // cyan
  "#FBBF24", // yellow
];

function colorFor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash * 31 + userId.charCodeAt(i)) | 0;
  }
  return PEER_COLORS[Math.abs(hash) % PEER_COLORS.length]!;
}

// ── Token verification (mirror of crm src/server/realtime.ts mint) ──────────

function base64urlDecode(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function verifyToken(
  token: string,
  secret: string,
): Promise<{ id: string; name: string; email: string | null } | null> {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sigHex = token.slice(dot + 1);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64),
  );
  const expectedHex = [...new Uint8Array(mac)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  // Constant-time-ish compare (same length, XOR accumulate).
  if (sigHex.length !== expectedHex.length) return null;
  let diff = 0;
  for (let i = 0; i < sigHex.length; i++) {
    diff |= sigHex.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  if (diff !== 0) return null;

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64))) as {
      id?: string;
      name?: string;
      email?: string | null;
      exp?: number;
    };
    if (typeof payload.id !== "string" || typeof payload.exp !== "number") {
      return null;
    }
    if (payload.exp * 1000 < Date.now()) return null;
    return {
      id: payload.id,
      name: typeof payload.name === "string" && payload.name !== "" ? payload.name : payload.id,
      email: typeof payload.email === "string" ? payload.email : null,
    };
  } catch {
    return null;
  }
}

// ── The room ────────────────────────────────────────────────────────────────

export class CrmRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Hibernation-friendly keepalive: the runtime answers pings without
    // waking the object.
    this.ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair(
        JSON.stringify({ type: "ping" }),
        JSON.stringify({ type: "pong" }),
      ),
    );
  }

  /** Browser socket entry — the outer worker has already verified the
   *  token and forwards the user as a header. */
  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    const userHeader = request.headers.get("x-rt-user");
    if (userHeader === null) {
      return new Response("missing identity", { status: 401 });
    }
    const parsed = JSON.parse(userHeader) as Omit<RealtimeUser, "color">;
    const user: RealtimeUser = { ...parsed, color: colorFor(parsed.id) };

    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    const attachment: SocketAttachment = { user, view: null };
    pair[1].serializeAttachment(attachment);

    // New joiner: everyone (including them) gets the fresh roster.
    this.broadcastPresence();
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== "string") return;
    let data: { type?: string; [k: string]: unknown };
    try {
      data = JSON.parse(message) as typeof data;
    } catch {
      return;
    }
    const attachment = ws.deserializeAttachment() as SocketAttachment | null;
    if (attachment === null) return;

    if (data.type === "view") {
      const view = data.view as SocketAttachment["view"];
      ws.serializeAttachment({
        ...attachment,
        view:
          view && typeof view.path === "string"
            ? {
                path: view.path,
                recordId: view.recordId ?? null,
                fieldKey: view.fieldKey ?? null,
              }
            : null,
      } satisfies SocketAttachment);
      this.broadcastPresence();
      return;
    }

    if (data.type === "cursor") {
      // Pure relay — never stored. Fan out to everyone else.
      const payload = JSON.stringify({
        type: "cursor",
        peer: {
          id: attachment.user.id,
          name: attachment.user.name,
          color: attachment.user.color,
        },
        recordId: data.recordId,
        x: data.x,
        y: data.y,
      });
      for (const socket of this.ctx.getWebSockets()) {
        if (socket !== ws) {
          try {
            socket.send(payload);
          } catch {
            // Socket already closing — the close handler prunes it.
          }
        }
      }
    }
  }

  async webSocketClose(): Promise<void> {
    this.broadcastPresence();
  }

  async webSocketError(): Promise<void> {
    this.broadcastPresence();
  }

  /** Server-to-server fan-out (RPC from the outer worker). */
  async broadcast(payload: unknown): Promise<number> {
    const message = JSON.stringify(payload);
    let sent = 0;
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(message);
        sent++;
      } catch {
        // Ignore sockets mid-close.
      }
    }
    return sent;
  }

  private broadcastPresence(): void {
    // Roster deduped by user id (two tabs = one person); an open view
    // wins over null so "viewing" survives a second background tab.
    const byId = new Map<string, { user: RealtimeUser; view: SocketAttachment["view"] }>();
    for (const socket of this.ctx.getWebSockets()) {
      const att = socket.deserializeAttachment() as SocketAttachment | null;
      if (att === null) continue;
      const existing = byId.get(att.user.id);
      if (existing === undefined || (existing.view === null && att.view !== null)) {
        byId.set(att.user.id, { user: att.user, view: att.view });
      }
    }
    const peers = [...byId.values()].map((p) => ({
      id: p.user.id,
      name: p.user.name,
      email: p.user.email,
      color: p.user.color,
      view: p.view,
    }));
    const message = JSON.stringify({ type: "presence", peers });
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(message);
      } catch {
        // Pruned on close.
      }
    }
  }
}

// ── Outer worker: token gate + broadcast door ───────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const [, kind, roomId] = url.pathname.split("/");

    if (kind === "room" && roomId) {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("expected websocket", { status: 426 });
      }
      const token = url.searchParams.get("token") ?? "";
      const user = await verifyToken(token, env.REALTIME_SECRET);
      if (user === null) return new Response("unauthorized", { status: 401 });

      const forwarded = new Request(request, {
        headers: new Headers([
          ...request.headers,
          ["x-rt-user", JSON.stringify(user)],
        ]),
      });
      return env.ROOM.getByName(roomId).fetch(forwarded);
    }

    if (kind === "broadcast" && roomId && request.method === "POST") {
      const auth = request.headers.get("Authorization") ?? "";
      if (auth !== `Bearer ${env.REALTIME_SECRET}`) {
        return new Response("unauthorized", { status: 401 });
      }
      const payload: unknown = await request.json();
      const sent = await env.ROOM.getByName(roomId).broadcast(payload);
      return Response.json({ sent });
    }

    if (url.pathname === "/") {
      return Response.json({ ok: true, service: "crm-realtime" });
    }
    return new Response("not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
