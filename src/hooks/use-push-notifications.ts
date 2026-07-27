"use client";

import { useState, useCallback, useSyncExternalStore } from "react";
import { notificationsApi } from "@/lib/notificationsApi";

const noopSubscribe = () => () => {};
const detectSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;

export function usePushNotifications() {
  // Feature detection is a static boolean — `useSyncExternalStore`
  // returns the server-safe `false` during SSR and on the very first
  // client render, then the real value after hydration commits.
  const supported = useSyncExternalStore(
    noopSubscribe,
    detectSupported,
    () => false,
  );

  const [permission, setPermission] =
    useState<NotificationPermission>("default");

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

  const subscribe = useCallback(async () => {
    if (!supported) return;

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return;

      const registration =
        await navigator.serviceWorker.register("/sw-push.js");
      await navigator.serviceWorker.ready;

      const { publicKey } = await notificationsApi.getVapidKey();
      if (!publicKey) return;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const sub = subscription.toJSON();
      await notificationsApi.subscribe({
        endpoint: sub.endpoint!,
        keys: sub.keys as { p256dh: string; auth: string },
      });
    } catch (err) {
      console.error("Push subscription failed:", err);
    }
  }, [supported]);

  return { supported, permission, subscribe };
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
