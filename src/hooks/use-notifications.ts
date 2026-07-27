"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { notificationsApi, type AppNotification } from "@/lib/notificationsApi";

export type { AppNotification };

const POLL_INTERVAL = 60_000;

export function useNotifications() {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const prevRef = useRef<string>("[]");

  const fetchNotifications = useCallback(async () => {
    if (document.hidden) return;
    try {
      const data = await notificationsApi.getNotifications();
      const json = JSON.stringify(data);
      if (json !== prevRef.current) {
        prevRef.current = json;
        setNotifications(data);
      }
    } catch {
      // silent — non-critical
    }
  }, []);

  const dismiss = useCallback(async (id: string) => {
    setNotifications((prev) => {
      const next = prev.filter((n) => n.id !== id);
      prevRef.current = JSON.stringify(next);
      return next;
    });
    try {
      await notificationsApi.dismiss(id);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    // Defer the first fetch by a microtask so the setState that
    // lands after `await` isn't classified as "synchronously called
    // from the effect body" by the React compiler.
    const initialId = window.setTimeout(() => {
      void fetchNotifications();
    }, 0);
    const interval = setInterval(fetchNotifications, POLL_INTERVAL);

    const onVisible = () => {
      if (!document.hidden) void fetchNotifications();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearTimeout(initialId);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fetchNotifications]);

  return { notifications, dismiss };
}
