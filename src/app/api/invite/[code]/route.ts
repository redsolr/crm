import { NextResponse } from "next/server";
import { apiError } from "@/server/api-error";
import {
  findInviteByCode,
  inviteStatus,
  serializePublicInvite,
} from "@/server/invites";

/**
 * `GET /api/invite/:code` — public validation for the accept page.
 * Deliberately unauthenticated: the high-entropy code IS the
 * capability, and the invitee has no session yet by definition.
 * Everything but a live pending invite answers 404 with a reason the
 * page can show.
 */

export async function GET(
  _request: Request,
  context: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const { code } = await context.params;
  const row = await findInviteByCode(code);
  if (row === null) {
    return apiError(404, "invite_not_found", "This invite link is invalid.");
  }
  const status = inviteStatus(row);
  if (status === "revoked") {
    return apiError(404, "invite_revoked", "This invite was revoked.");
  }
  if (status === "expired") {
    return apiError(
      404,
      "invite_expired",
      "This invite has expired — ask for a new one.",
    );
  }
  return NextResponse.json({ invite: serializePublicInvite(row) });
}
