import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";
import type { NotificationId } from "./ids";

export interface AppNotification {
  id: NotificationId;
  type: "info" | "warning" | "success" | "error" | "broadcast";
  title: string;
  message: string;
  created_at: string;
}

class NotificationsApiClient extends BaseApiClient {
  getNotifications() {
    return this.request<AppNotification[]>("/notifications");
  }

  dismiss(id: string, idempotencyKey: string = freshIdempotencyKey()) {
    return this.request<{ dismissed: boolean }>(
      `/notifications/${id}/dismiss`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
  }

  getVapidKey() {
    return this.request<{ publicKey: string }>("/notifications/vapid-key");
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
}

export const notificationsApi = new NotificationsApiClient();
