import { NextResponse } from "next/server";
import { vapidPublicKey } from "@/server/push";

/**
 * `GET /api/notifications/vapid-key` — the public half of the VAPID
 * pair, needed by `PushManager.subscribe`. `publicKey: null` means the
 * push layer is not configured on this deployment (env-gated like
 * realtime) — the client renders no enable affordance.
 */
export function GET(): NextResponse {
  return NextResponse.json({ publicKey: vapidPublicKey() });
}
