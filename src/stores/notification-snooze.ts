import { create } from "zustand";

/**
 * Notification snooze (Slack's "Pause notifications"). Client-side and
 * persisted: while snoozed, the NotificationBell hides its unread badge and
 * renders a paused state, and push display is suppressed. A single
 * `snoozedUntil` epoch-ms timestamp; expiry is lazy (compared to now on read).
 */

const STORAGE_KEY = "notification-snooze-until";

function readUntil(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null || raw === "") return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= Date.now()) return null;
    return n;
  } catch (err) {
    console.warn("[notification-snooze] read failed", err);
    return null;
  }
}

function writeUntil(value: number | null): void {
  if (typeof window === "undefined") return;
  try {
    if (value == null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, String(value));
  } catch (err) {
    console.warn("[notification-snooze] write failed", err);
  }
}

/** Human label for a snooze expiry (e.g. "Mon 09:00"). */
export function formatSnoozeUntil(until: number): string {
  return new Date(until).toLocaleString([], {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Tomorrow at 09:00 local — the "until tomorrow" preset. */
function tomorrowMorning(): number {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.getTime();
}

export const SNOOZE_PRESETS: { id: string; label: string; until: () => number }[] =
  [
    { id: "30m", label: "For 30 minutes", until: () => Date.now() + 30 * 60_000 },
    { id: "1h", label: "For 1 hour", until: () => Date.now() + 60 * 60_000 },
    { id: "tomorrow", label: "Until tomorrow", until: tomorrowMorning },
  ];

interface SnoozeState {
  snoozedUntil: number | null;
  snooze: (until: number) => void;
  resume: () => void;
  /** True while a snooze is active (lazy-expired against now). */
  isSnoozed: () => boolean;
}

export const useNotificationSnooze = create<SnoozeState>((set, get) => ({
  snoozedUntil: readUntil(),
  snooze: (until) => {
    writeUntil(until);
    set({ snoozedUntil: until });
  },
  resume: () => {
    writeUntil(null);
    set({ snoozedUntil: null });
  },
  isSnoozed: () => {
    const until = get().snoozedUntil;
    return until != null && until > Date.now();
  },
}));
