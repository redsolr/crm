import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, invites } from "@/db";
import { apiError } from "@/server/api-error";
import { currentActor } from "@/server/actor";
import {
  actorMayManageInvites,
  inviteStatus,
  serializeInvite,
} from "@/server/invites";
import { requireApiSession } from "@/server/api-auth";

/**
 * `DELETE /api/invites/:id` — revoke a pending invite (the link stops
 * working). Accepted invites can't be revoked here: the seat already
 * exists in AuthKit, and removing a person is a WorkOS-dashboard action
 * until team management grows a surface for it.
 */

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const gate = await requireApiSession();
  if (!gate.ok) return gate.response;
  const { id } = await context.params;
  const actor = await currentActor();
  if (!actorMayManageInvites(actor.id)) {
    return apiError(401, "unauthorized", "Sign in to manage invites.");
  }
  const row = await db.query.invites.findFirst({
    where: (t, { eq: eqOp }) => eqOp(t.id, id),
  });
  if (!row) return apiError(404, "not_found", "No such invite.");
  const status = inviteStatus(row);
  if (status === "accepted") {
    return apiError(
      409,
      "already_accepted",
      "This invite was already accepted — the seat exists; remove the user in WorkOS instead.",
    );
  }
  if (status !== "revoked") {
    await db
      .update(invites)
      .set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(eq(invites.id, id));
  }
  const updated = await db.query.invites.findFirst({
    where: (t, { eq: eqOp }) => eqOp(t.id, id),
  });
  if (!updated) throw new Error(`Invite ${id} vanished after revoke`);
  return NextResponse.json({ invite: serializeInvite(updated) });
}
