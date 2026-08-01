import { createHmac } from "node:crypto";
import { CRM_WORKSPACE_ID } from "./constants";

/**
 * Server half of the realtime collaboration channel (the `realtime/`
 * Cloudflare worker is the other half — see docs/realtime.md).
 *
 * Two jobs:
 *   - mint short-lived HMAC tokens so a session-authed browser may open
 *     a WebSocket to the worker, and
 *   - fan out "data changed" events after writes so every connected
 *     client refetches (cross-user cache invalidation, deferred row 23).
 *
 * Feature-gated on env: with `REALTIME_URL` / `REALTIME_SECRET` unset
 * every function is a cheap no-op and the product behaves exactly as
 * before — the worker can be deployed later without a crm redeploy.
 */

const TOKEN_TTL_SECONDS = 60 * 60; // reconnects re-fetch /api/realtime/session

export function realtimeEnabled(): boolean {
  return (
    typeof process.env.REALTIME_URL === "string" &&
    process.env.REALTIME_URL !== "" &&
    typeof process.env.REALTIME_SECRET === "string" &&
    process.env.REALTIME_SECRET !== ""
  );
}

/** Browser-facing wss:// URL for the workspace room, token included. */
export function realtimeSocketUrl(user: {
  id: string;
  name: string | null;
  email: string | null;
}): string {
  const base = process.env.REALTIME_URL!.replace(/^http/, "ws").replace(/\/$/, "");
  const token = mintRealtimeToken(user);
  return `${base}/room/${CRM_WORKSPACE_ID}?token=${encodeURIComponent(token)}`;
}

/** `base64url(payload).hex(hmac)` — verified by the worker with the
 *  shared `REALTIME_SECRET`. */
export function mintRealtimeToken(
  user: { id: string; name: string | null; email: string | null },
  nowMs: number = Date.now(),
): string {
  const payload = Buffer.from(
    JSON.stringify({
      id: user.id,
      name: user.name ?? user.email?.split("@")[0] ?? user.id,
      email: user.email,
      exp: Math.floor(nowMs / 1000) + TOKEN_TTL_SECONDS,
    }),
  ).toString("base64url");
  const sig = createHmac("sha256", process.env.REALTIME_SECRET!)
    .update(payload)
    .digest("hex");
  return `${payload}.${sig}`;
}

/**
 * Fire-and-forget "something changed" fan-out — called from the write
 * paths (work items, attribute values, comments). Never awaited by the
 * caller's response and never throws: realtime is best-effort, the
 * write itself already succeeded.
 */
export function broadcastInvalidate(scope: "records" | "comments"): void {
  if (!realtimeEnabled()) return;
  const url = `${process.env.REALTIME_URL!.replace(/\/$/, "")}/broadcast/${CRM_WORKSPACE_ID}`;
  void fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${process.env.REALTIME_SECRET!}`,
    },
    body: JSON.stringify({ type: "invalidate", scope }),
  }).catch((err: unknown) => {
    console.warn("[realtime] broadcast failed (non-fatal):", err);
  });
}
