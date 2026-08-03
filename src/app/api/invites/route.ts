import { NextResponse, type NextRequest } from "next/server";
import { desc } from "drizzle-orm";
import { db, invites } from "@/db";
import { mintId } from "@/db/ids";
import { apiError, readJsonBody } from "@/server/api-error";
import { currentActor } from "@/server/actor";
import {
  INVITE_TTL_DAYS,
  actorMayManageInvites,
  createInviteSchema,
  findPendingInviteByEmail,
  mintInviteCode,
  serializeInvite,
} from "@/server/invites";

/**
 * Admin surface of the CRM-native invite flow:
 * `GET /api/invites` → `{ data }` (newest first) and
 * `POST /api/invites` → `{ invite }` (201; 200 with the EXISTING invite
 * when a pending one already covers the email — dedupe, not an error,
 * so "invite them again" just re-surfaces the same link).
 *
 * Session-gated by the proxy like every app route; the actor stamps
 * `invited_by_*` for the accept page's "X invited you" line.
 */

export async function GET(): Promise<NextResponse> {
  const actor = await currentActor();
  if (!actorMayManageInvites(actor.id)) {
    return apiError(401, "unauthorized", "Sign in to manage invites.");
  }
  const rows = await db
    .select()
    .from(invites)
    .orderBy(desc(invites.createdAt))
    .limit(100);
  return NextResponse.json({ data: rows.map(serializeInvite) });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const parsed = createInviteSchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    return apiError(
      422,
      "validation_failed",
      "Request body failed validation",
      parsed.error.issues,
    );
  }
  const email = parsed.data.email;

  const actor = await currentActor();
  if (!actorMayManageInvites(actor.id)) {
    return apiError(401, "unauthorized", "Sign in to manage invites.");
  }

  const existing = await findPendingInviteByEmail(email);
  if (existing !== null) {
    return NextResponse.json({ invite: serializeInvite(existing) });
  }

  const id = mintId("inv");
  const expiresAt = new Date(
    Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000,
  );
  await db.insert(invites).values({
    id,
    code: mintInviteCode(),
    email,
    invitedById: actor.id,
    invitedByName: actor.name,
    expiresAt,
  });
  const created = await db.query.invites.findFirst({
    where: (t, { eq }) => eq(t.id, id),
  });
  if (!created) throw new Error(`Invite ${id} vanished after insert`);
  return NextResponse.json(
    { invite: serializeInvite(created) },
    { status: 201 },
  );
}
