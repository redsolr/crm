import { BaseApiClient } from "@/lib/api-client";
import { freshIdempotencyKey } from "@/lib/idempotency";

/**
 * Presence status client — Slack's Active/Away + custom status, persisted
 * per member per workspace (`/v1/presence/status` + `/v1/presence/statuses`).
 * Distinct from the anonymous heartbeat (`/presence/heartbeat`).
 */

export type Availability = "active" | "away";

export interface UserStatus {
  account_id: string;
  availability: Availability;
  status_emoji: string | null;
  status_text: string | null;
  status_expires_at: string | null;
  updated_at: string;
}

export interface UpdateUserStatusInput {
  availability?: Availability;
  status_emoji?: string | null;
  status_text?: string | null;
  status_expires_at?: string | null;
  clear_status?: boolean;
}

class PresenceStatusClient extends BaseApiClient {
  /** The caller's own status for the active workspace. */
  async getOwn(): Promise<UserStatus> {
    const res = await this.request<{ user_status: UserStatus }>(
      "/presence/status",
    );
    return res.user_status;
  }

  /** Set the caller's own availability / custom status. */
  async update(input: UpdateUserStatusInput): Promise<UserStatus> {
    const res = await this.request<{ user_status: UserStatus }>(
      "/presence/status",
      {
        method: "PUT",
        body: JSON.stringify(input),
        headers: { "Idempotency-Key": freshIdempotencyKey() },
      },
    );
    return res.user_status;
  }

  /** Batch-read statuses for teammates (presence dots in team-chat). */
  async getForAccounts(accountIds: string[]): Promise<UserStatus[]> {
    const ids = accountIds.filter(Boolean);
    if (ids.length === 0) return [];
    const res = await this.request<{ data: UserStatus[] }>(
      `/presence/statuses?account_ids=${encodeURIComponent(ids.join(","))}`,
    );
    return res.data;
  }
}

export const presenceStatusApi = new PresenceStatusClient();
