import { NextResponse } from "next/server";
import { vapidPublicKey } from "@/server/push";
import { requireApiSession } from "@/server/api-auth";

/**
 * `GET /api/notifications/vapid-key` — the public half of the VAPID
 * pair, needed by `PushManager.subscribe`. `publicKey: null` means the
 * push layer is not configured on this deployment (env-gated like
 * realtime) — the client renders no enable affordance.
 */
export async function GET(): Promise<NextResponse> {
  const gate = await requireApiSession();
  if (!gate.ok) return gate.response;
  return NextResponse.json({ publicKey: vapidPublicKey() });
}
