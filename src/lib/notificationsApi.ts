import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";

/**
 * Web-push subscription client (ambient-digest arc). The fork-era
 * in-app notification feed (`GET /notifications` + dismiss) died with
 * the platform swap — this client is the PUSH surface only:
 * vapid-key + subscribe/unsubscribe against the in-repo routes.
 */

class NotificationsApiClient extends BaseApiClient {
  getVapidKey() {
    return this.request<{ publicKey: string | null }>(
      "/notifications/vapid-key",
    );
  }

  subscribe(
    subscription: {
      endpoint: string;
      keys: { p256dh: string; auth: string };
    },
    idempotencyKey: string = freshIdempotencyKey(),
  ) {
    return this.request<{ subscribed: boolean }>(
      "/notifications/push/subscribe",
      {
        method: "POST",
        body: JSON.stringify(subscription),
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
  }

  unsubscribe(
    endpoint: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ) {
    return this.request<{ subscribed: boolean }>(
      "/notifications/push/subscribe",
      {
        method: "DELETE",
        body: JSON.stringify({ endpoint }),
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
  }
}

export const notificationsApi = new NotificationsApiClient();
