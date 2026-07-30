"use client";

import { authService } from "@/lib/authTokenManager";
import { useAuthStore } from "@/stores/auth.store";
import { API_ROOT } from "@/lib/api-base";

const HEARTBEAT_INTERVAL =
  Number(process.env.NEXT_PUBLIC_PRESENCE_INTERVAL) || 60_000;

/** Minimum time between heartbeats to avoid 429 on rapid visibility changes */
const MIN_HEARTBEAT_GAP = 10_000; // 10 seconds

let timer: ReturnType<typeof setInterval> | null = null;
let lastHeartbeatTime = 0;

function sendHeartbeat() {
  // Cookie-auth: there's no JS-readable access token to short-circuit
  // on, so use the store-resident user as the cheapest "is the user
  // signed in?" proxy. If `user` is null, the heartbeat is pointless.
  // The cookie itself rides along automatically via `credentials:
  // 'include'` if it exists.
  if (useAuthStore.getState().user === null) return;

  const now = Date.now();
  if (now - lastHeartbeatTime < MIN_HEARTBEAT_GAP) {
    return; // Too soon since last heartbeat — skip
  }
  lastHeartbeatTime = now;

  const csrf = authService.getCsrfToken();
  fetch(`${API_ROOT}/presence/heartbeat`, {
    method: "POST",
    credentials: "include",
    headers: {
      ...(csrf !== null ? { "X-CSRF-Token": csrf } : {}),
    },
  }).catch((err) => {
    // Presence is non-critical, but losing every heartbeat silently
    // makes "is the active-user count broken?" untraceable in the
    // browser console.
    console.warn("[presence] heartbeat failed:", err);
  });
}

function handleVisibility() {
  if (document.visibilityState === "visible") {
    if (!timer) {
      sendHeartbeat();
      timer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);
    }
  } else {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }
}

export function startPresence() {
  if (timer) return;

  sendHeartbeat();
  timer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

  document.addEventListener("visibilitychange", handleVisibility);
}

export function stopPresence() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  document.removeEventListener("visibilitychange", handleVisibility);
}
