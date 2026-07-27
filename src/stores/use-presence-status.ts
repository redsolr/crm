import { create } from "zustand";
import {
  presenceStatusApi,
  type UserStatus,
  type Availability,
} from "@/lib/presence/status-client";

/**
 * The signed-in user's OWN presence status (availability + custom status),
 * shared so the account menu header and the away toggle reflect it
 * app-wide. Teammates' statuses (for team-chat dots) are fetched separately
 * via `presenceStatusApi.getForAccounts`.
 */
interface PresenceStatusState {
  status: UserStatus | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setAvailability: (availability: Availability) => Promise<void>;
  setStatus: (
    emoji: string | null,
    text: string | null,
    expiresAt: string | null,
  ) => Promise<void>;
  clearStatus: () => Promise<void>;
}

export const usePresenceStatus = create<PresenceStatusState>((set) => ({
  status: null,
  loading: false,

  refresh: async () => {
    set({ loading: true });
    try {
      set({ status: await presenceStatusApi.getOwn() });
    } catch (err) {
      console.error("[presence-status] refresh failed", err);
    } finally {
      set({ loading: false });
    }
  },

  setAvailability: async (availability) => {
    try {
      set({ status: await presenceStatusApi.update({ availability }) });
    } catch (err) {
      console.error("[presence-status] setAvailability failed", err);
    }
  },

  setStatus: async (emoji, text, expiresAt) => {
    try {
      set({
        status: await presenceStatusApi.update({
          status_emoji: emoji,
          status_text: text,
          status_expires_at: expiresAt,
        }),
      });
    } catch (err) {
      console.error("[presence-status] setStatus failed", err);
    }
  },

  clearStatus: async () => {
    try {
      set({ status: await presenceStatusApi.update({ clear_status: true }) });
    } catch (err) {
      console.error("[presence-status] clearStatus failed", err);
    }
  },
}));
