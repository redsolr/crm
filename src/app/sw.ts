import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";
import type { PushPayload } from "@/server/push";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

/**
 * Web-push display (ambient-digest arc, 2026-08-07). The server sends
 * a JSON `PushPayload` (`src/server/push.ts`); the `tag` collapses
 * repeated digests into one bubble instead of a morning pile.
 */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  // Type-only import — erased at compile, so the SW bundle never pulls
  // server code; the shape stays single-sourced with the sender.
  let payload: Partial<PushPayload>;
  try {
    payload = event.data.json() as Partial<PushPayload>;
  } catch (error) {
    console.error("[sw] push payload is not JSON — dropping it:", error);
    return;
  }
  event.waitUntil(
    self.registration.showNotification(payload.title ?? "CRM", {
      body: payload.body ?? "",
      icon: "/icons/icon-192.png",
      tag: payload.tag ?? "crm-digest",
      data: { url: payload.url ?? "/sales" },
    }),
  );
});

/** Click focuses an existing CRM tab (navigating it) or opens one. */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data as { url?: string } | undefined;
  const url = data?.url ?? "/sales";
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows[0];
      if (existing) {
        await existing.focus();
        await existing.navigate(url);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
