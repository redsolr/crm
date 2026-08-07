"use client";

import {
  useCallback,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import { notificationsApi } from "@/lib/notificationsApi";

/**
 * Enable/disable web-push for THIS browser (ambient-digest arc).
 *
 * The service worker is serwist's `/sw.js` (auto-registered by
 * `@serwist/next` in production builds; DISABLED in dev — the hook
 * reports `available: false` there and the UI renders nothing).
 * Configuration is env-gated server-side: a null VAPID key from
 * `/api/notifications/vapid-key` also means "render nothing".
 */

const noopSubscribe = () => () => {};
const detectSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export interface PushNotificationsState {
  /** Browser capability AND a live service-worker registration. */
  available: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
  busy: boolean;
  enable: () => Promise<void>;
  disable: () => Promise<void>;
}

export function usePushNotifications(): PushNotificationsState {
  // Feature detection is a static boolean — `useSyncExternalStore`
  // returns the server-safe `false` during SSR and on the very first
  // client render, then the real value after hydration commits.
  const supported = useSyncExternalStore(
    noopSubscribe,
    detectSupported,
    () => false,
  );

  const [registration, setRegistration] =
    useState<ServiceWorkerRegistration | null>(null);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  // Capture the current Notification.permission once `supported`
  // flips true — adjusting state during render
  // (https://react.dev/reference/react/useState#storing-information-from-previous-renders)
  // rather than via a setState-in-effect cascade.
  const [lastSupported, setLastSupported] = useState(supported);
  if (supported !== lastSupported) {
    if (supported && typeof Notification !== "undefined") {
      setPermission(Notification.permission);
    }
    setLastSupported(supported);
  }

  // Resolve the serwist registration + current subscription state.
  // `getRegistration` (not `.ready`) — in dev no SW ever registers and
  // `.ready` would hang the effect forever.
  useEffect(() => {
    if (!supported) return;
    let cancelled = false;
    void (async () => {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (cancelled || !reg) return;
        setRegistration(reg);
        const sub = await reg.pushManager.getSubscription();
        if (!cancelled) setSubscribed(sub !== null);
      } catch (error) {
        console.error("[push] failed to resolve SW registration:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supported]);

  const enable = useCallback(async () => {
    if (!registration) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;

      const { publicKey } = await notificationsApi.getVapidKey();
      if (!publicKey) {
        console.warn("[push] server has no VAPID key — push is off");
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      const sub = subscription.toJSON();
      if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys.auth) {
        throw new Error("PushSubscription serialized without endpoint/keys");
      }
      await notificationsApi.subscribe({
        endpoint: sub.endpoint,
        keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
      });
      setSubscribed(true);
    } catch (error) {
      console.error("[push] enable failed:", error);
    } finally {
      setBusy(false);
    }
  }, [registration]);

  const disable = useCallback(async () => {
    if (!registration) return;
    setBusy(true);
    try {
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await notificationsApi.unsubscribe(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setSubscribed(false);
    } catch (error) {
      console.error("[push] disable failed:", error);
    } finally {
      setBusy(false);
    }
  }, [registration]);

  return {
    available: supported && registration !== null,
    permission,
    subscribed,
    busy,
    enable,
    disable,
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    out[i] = raw.charCodeAt(i);
  }
  return out;
}
