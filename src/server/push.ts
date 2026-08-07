import webpush from "web-push";
import { eq } from "drizzle-orm";
import { db, pushSubscriptions } from "@/db";
import { mintId } from "@/db/ids";

/**
 * Web-push seam (ambient-digest arc, 2026-08-07). The whole layer is
 * env-gated like realtime: `VAPID_PUBLIC_KEY` + `VAPID_PRIVATE_KEY`
 * unset ⇒ the vapid-key route answers null, the UI renders no enable
 * button, and `sendPushToAll` throws (a digest run that EXPECTS to
 * notify must fail loudly, never silently skip).
 *
 * Key generation (founder, one-time): `npx web-push generate-vapid-keys`
 * → the pair goes into Vercel env + `.env.local`. `VAPID_SUBJECT`
 * defaults to the ops mailbox; push services use it to reach the sender
 * about misbehaving delivery.
 */

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushPayload {
  title: string;
  body: string;
  /** In-app path the notification click opens. */
  url: string;
  /** Collapses same-tag notifications (one digest bubble, not a pile). */
  tag?: string;
}

export function pushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );
}

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

function configureWebpush(): void {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error(
      "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not configured — web push cannot run.",
    );
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@jurisimus.com",
    publicKey,
    privateKey,
  );
}

export async function upsertPushSubscription(
  input: PushSubscriptionInput,
  actor: { id: string; name: string | null },
  userAgent: string | null,
): Promise<void> {
  await db
    .insert(pushSubscriptions)
    .values({
      id: mintId("psub"),
      endpoint: input.endpoint,
      p256dh: input.keys.p256dh,
      auth: input.keys.auth,
      accountId: actor.id,
      accountName: actor.name,
      userAgent,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        accountId: actor.id,
        accountName: actor.name,
        userAgent,
        updatedAt: new Date(),
      },
    });
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
}

export interface PushSendReport {
  sent: number;
  /** Endpoints the push service reported gone (404/410) — deleted. */
  removed: number;
  /** Transient failures (kept for the next run). */
  failed: number;
}

/**
 * Fan a payload out to every stored subscription. Endpoints the push
 * service reports as gone are deleted in place; other failures are
 * logged and counted but never abort the fan-out.
 */
export async function sendPushToAll(
  payload: PushPayload,
): Promise<PushSendReport> {
  configureWebpush();
  const subscriptions = await db.select().from(pushSubscriptions);
  const report: PushSendReport = { sent: 0, removed: 0, failed: 0 };
  const body = JSON.stringify(payload);

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        body,
      );
      report.sent += 1;
    } catch (error) {
      const statusCode =
        typeof error === "object" &&
        error !== null &&
        typeof (error as { statusCode?: unknown }).statusCode === "number"
          ? (error as { statusCode: number }).statusCode
          : null;
      if (statusCode === 404 || statusCode === 410) {
        // The browser installation is gone — the row is dead weight.
        await removePushSubscription(sub.endpoint);
        report.removed += 1;
        console.warn(
          `[push] subscription gone (${statusCode}) — removed ${sub.id}`,
        );
      } else {
        report.failed += 1;
        console.error(`[push] delivery failed for ${sub.id}:`, error);
      }
    }
  }
  return report;
}
