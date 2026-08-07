import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiError, readJsonBody } from "@/server/api-error";
import { currentActor } from "@/server/actor";
import {
  pushConfigured,
  removePushSubscription,
  upsertPushSubscription,
} from "@/server/push";
import { requireApiSession } from "@/server/api-auth";

/**
 * `POST /api/notifications/push/subscribe` — store this browser's push
 * subscription (upsert by endpoint; re-subscribing after a key rotation
 * replaces the row). `DELETE` removes it (the in-app "notifications
 * off" toggle). Both stamp the session actor for audit.
 */

const subscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
});

const unsubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await requireApiSession();
  if (!gate.ok) return gate.response;
  if (!pushConfigured()) {
    return apiError(
      503,
      "push_unconfigured",
      "Web push is not configured on this deployment",
    );
  }
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = subscribeSchema.safeParse(parsed.body);
  if (!body.success) {
    return apiError(422, "validation_failed", body.error.message);
  }

  const actor = await currentActor();
  await upsertPushSubscription(
    body.data,
    { id: actor.id, name: actor.name },
    request.headers.get("user-agent"),
  );
  return NextResponse.json({ subscribed: true });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const gate = await requireApiSession();
  if (!gate.ok) return gate.response;
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = unsubscribeSchema.safeParse(parsed.body);
  if (!body.success) {
    return apiError(422, "validation_failed", body.error.message);
  }
  await removePushSubscription(body.data.endpoint);
  return NextResponse.json({ subscribed: false });
}
