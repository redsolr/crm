/**
 * YDocRoom — one Durable Object per co-edited document (the live note
 * on a CRM record; room name = the record id). Speaks the standard
 * y-websocket wire protocol so the client is the stock
 * `y-websocket` WebsocketProvider + TipTap's Collaboration extensions:
 *
 *   message 0 (sync)      — Yjs sync steps + document updates
 *   message 1 (awareness) — carets/selections/user info
 *
 * Persistence: the merged Yjs state is written to DO storage on every
 * update (notes are small — full-state writes stay cheap) and loaded
 * in the constructor, so the doc survives hibernation and eviction.
 * Awareness is ephemeral by design; clients re-broadcast their state
 * on the y-protocols heartbeat, which also recovers it after a wake.
 */

import { DurableObject } from "cloudflare:workers";
import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import type { Env } from "./index";

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

const STORAGE_KEY = "ydoc-state";

/** ClientIds contained in an awareness update (mirror of the wire
 *  format `applyAwarenessUpdate` reads: count, then per entry
 *  clientId · clock · state-JSON). */
function awarenessClientIds(update: Uint8Array): number[] {
  try {
    const decoder = decoding.createDecoder(update);
    const count = decoding.readVarUint(decoder);
    const ids: number[] = [];
    for (let i = 0; i < count; i++) {
      ids.push(decoding.readVarUint(decoder)); // clientId
      decoding.readVarUint(decoder); // clock
      decoding.readVarString(decoder); // state JSON (or "null")
    }
    return ids;
  } catch (err) {
    console.warn("[ydoc] unparseable awareness update:", err);
    return [];
  }
}

export class YDocRoom extends DurableObject<Env> {
  private doc: Y.Doc;
  private awareness: awarenessProtocol.Awareness;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.doc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.doc);
    // The server holds no local awareness state of its own.
    this.awareness.setLocalState(null);

    ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<Uint8Array>(STORAGE_KEY);
      if (saved !== undefined) {
        Y.applyUpdate(this.doc, saved);
      }
    });

    // Fan out document updates to every connected client and persist
    // the merged state. `origin` is the source socket (set by
    // readSyncMessage's transaction origin) — skip echoing back.
    this.doc.on("update", (update: Uint8Array, origin: unknown) => {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.writeUpdate(encoder, update);
      this.broadcast(encoding.toUint8Array(encoder), origin);
      void this.ctx.storage.put(STORAGE_KEY, Y.encodeStateAsUpdate(this.doc));
    });

    // Fan out awareness changes (carets) to everyone except the origin.
    this.awareness.on(
      "update",
      (
        changes: { added: number[]; updated: number[]; removed: number[] },
        origin: unknown,
      ) => {
        const changed = [
          ...changes.added,
          ...changes.updated,
          ...changes.removed,
        ];
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
        encoding.writeVarUint8Array(
          encoder,
          awarenessProtocol.encodeAwarenessUpdate(this.awareness, changed),
        );
        this.broadcast(encoding.toUint8Array(encoder), origin);
      },
    );
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("expected websocket", { status: 426 });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);

    // Server-initiated handshake (y-websocket contract): sync step 1
    // plus current awareness states.
    const sync = encoding.createEncoder();
    encoding.writeVarUint(sync, MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(sync, this.doc);
    pair[1].send(encoding.toUint8Array(sync));

    const states = this.awareness.getStates();
    if (states.size > 0) {
      const aw = encoding.createEncoder();
      encoding.writeVarUint(aw, MESSAGE_AWARENESS);
      encoding.writeVarUint8Array(
        aw,
        awarenessProtocol.encodeAwarenessUpdate(this.awareness, [
          ...states.keys(),
        ]),
      );
      pair[1].send(encoding.toUint8Array(aw));
    }

    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(
    ws: WebSocket,
    message: string | ArrayBuffer,
  ): Promise<void> {
    if (typeof message === "string") return; // protocol is binary-only
    const decoder = decoding.createDecoder(new Uint8Array(message));
    const messageType = decoding.readVarUint(decoder);

    if (messageType === MESSAGE_SYNC) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MESSAGE_SYNC);
      syncProtocol.readSyncMessage(decoder, encoder, this.doc, ws);
      // Reply only when the handler wrote something (sync step 2 /
      // requested updates) — length 1 is just our type varint.
      if (encoding.length(encoder) > 1) {
        try {
          ws.send(encoding.toUint8Array(encoder));
        } catch (err) {
          console.warn("[ydoc] reply failed (socket closing):", err);
        }
      }
      return;
    }

    if (messageType === MESSAGE_AWARENESS) {
      const update = decoding.readVarUint8Array(decoder);
      // Track which Yjs clientIds this SOCKET speaks for (survives
      // hibernation via the attachment) so departure removes exactly
      // its carets and nobody else's.
      const incoming = awarenessClientIds(update);
      if (incoming.length > 0) {
        const attachment =
          (ws.deserializeAttachment() as { clientIds?: number[] } | null) ?? {};
        const known = new Set(attachment.clientIds ?? []);
        for (const id of incoming) known.add(id);
        ws.serializeAttachment({ ...attachment, clientIds: [...known] });
      }
      awarenessProtocol.applyAwarenessUpdate(this.awareness, update, ws);
    }
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    this.dropSocketAwareness(ws);
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    this.dropSocketAwareness(ws);
  }

  /** Remove awareness entries owned by a departed socket so its caret
   *  doesn't linger for the peers. */
  private dropSocketAwareness(ws: WebSocket): void {
    const attachment = ws.deserializeAttachment() as {
      clientIds?: number[];
    } | null;
    const owned = attachment?.clientIds ?? [];
    if (owned.length > 0) {
      awarenessProtocol.removeAwarenessStates(this.awareness, owned, ws);
    }
  }

  private broadcast(payload: Uint8Array, exceptOrigin: unknown): void {
    for (const socket of this.ctx.getWebSockets()) {
      if (socket === exceptOrigin) continue;
      try {
        socket.send(payload);
      } catch {
        // Socket mid-close — pruned by the close handler.
      }
    }
  }
}
