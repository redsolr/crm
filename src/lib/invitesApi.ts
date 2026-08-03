/**
 * Seat-invites API client (own-the-invite-flow arc, 2026-08-03).
 *
 * Hits `/api/invites` — the ADMIN surface (session-gated): list,
 * create (dedupes onto an existing pending invite for the email),
 * revoke. The public accept endpoints (`/api/invite/:code[...]`) are
 * called directly by the /invite page, not through this client — the
 * invitee has no session yet.
 */

import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";

export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

export interface SeatInvite {
  id: string;
  email: string;
  status: InviteStatus;
  /** App-relative accept URL (`/invite/<code>`) — join with origin to share. */
  invite_path: string;
  invited_by_name: string | null;
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
  created_at: string;
}

class InvitesApiClient extends BaseApiClient {
  async listInvites(): Promise<SeatInvite[]> {
    const raw = await this.request<{ data: SeatInvite[] }>("/invites", {
      method: "GET",
    });
    return raw.data;
  }

  async createInvite(
    email: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<SeatInvite> {
    const raw = await this.request<{ invite: SeatInvite }>("/invites", {
      method: "POST",
      body: JSON.stringify({ email }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return raw.invite;
  }

  async revokeInvite(
    id: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<SeatInvite> {
    const raw = await this.request<{ invite: SeatInvite }>(`/invites/${id}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return raw.invite;
  }
}

export const invitesApi = new InvitesApiClient();
