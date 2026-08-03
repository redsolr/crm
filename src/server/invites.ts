import { randomBytes } from "crypto";
import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db, invites } from "@/db";
import { getWorkOS, clientId } from "@/lib/workos";
import { LOCAL_ACTOR_ID } from "./constants";

/**
 * CRM-native seat invites — the own-the-invite-flow arc (2026-08-03).
 *
 * The invite record authorizes an email to enter the CRM; WorkOS is a
 * silent backend. Accepting provisions the AuthKit user server-side
 * (`ensureWorkosUser`), so the invitee authenticates on OUR branded
 * pages and never sees a WorkOS-hosted screen. v1 is link-first: the
 * creator copies `/invite/<code>` and shares it; automated email needs
 * a provider decision first (see docs/design-personal-notes.md's
 * sibling brief).
 *
 * Built kit-shaped for reuse: this module owns CRM specifics; the
 * `InviteCard` component + page flow copy into the Jurisimus web-app,
 * which points them at the platform's own invite endpoints.
 */

export const INVITE_TTL_DAYS = 7;

/**
 * Granting a seat is an admin capability — same guard as the realtime
 * session mint: a real AuthKit session outside MOCK_AUTH, the local
 * fallback actor only inside it. (The public validate/accept routes are
 * deliberately NOT gated: the invite code itself is the capability.)
 */
export function actorMayManageInvites(actorId: string): boolean {
  return actorId !== LOCAL_ACTOR_ID || process.env.MOCK_AUTH === "true";
}

export type InviteRow = typeof invites.$inferSelect;

export type InviteStatus = "pending" | "accepted" | "revoked" | "expired";

export function inviteStatus(row: InviteRow, now = new Date()): InviteStatus {
  if (row.revokedAt !== null) return "revoked";
  if (row.acceptedAt !== null) return "accepted";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  return "pending";
}

/** Admin-facing wire shape (list + create responses). Includes the
 *  code-bearing URL path — the admin surface is how links get shared. */
export function serializeInvite(row: InviteRow): Record<string, unknown> {
  return {
    id: row.id,
    email: row.email,
    status: inviteStatus(row),
    invite_path: `/invite/${row.code}`,
    invited_by_name: row.invitedByName,
    expires_at: row.expiresAt.toISOString(),
    accepted_at: row.acceptedAt === null ? null : row.acceptedAt.toISOString(),
    revoked_at: row.revokedAt === null ? null : row.revokedAt.toISOString(),
    created_at: row.createdAt.toISOString(),
  };
}

/** Public wire shape for the accept page — everything the invitee may
 *  see, nothing the admin surface adds. The code IS the capability, so
 *  showing the invited email to its holder is fine (they were sent it). */
export function serializePublicInvite(row: InviteRow): Record<string, unknown> {
  return {
    email: row.email,
    status: inviteStatus(row),
    invited_by_name: row.invitedByName,
    expires_at: row.expiresAt.toISOString(),
  };
}

export const createInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const acceptInviteSchema = z.discriminatedUnion("method", [
  z.object({ method: z.literal("oauth") }),
  z.object({
    method: z.literal("password"),
    password: z.string().min(10, "Password must be at least 10 characters."),
    first_name: z.string().trim().max(100).optional(),
    last_name: z.string().trim().max(100).optional(),
  }),
]);

/** High-entropy URL-safe token (24 bytes → 32 base64url chars). */
export function mintInviteCode(): string {
  return randomBytes(24).toString("base64url");
}

export async function findInviteByCode(code: string): Promise<InviteRow | null> {
  const rows = await db
    .select()
    .from(invites)
    .where(eq(invites.code, code))
    .limit(1);
  return rows[0] ?? null;
}

/** Active (pending, unexpired) invite for an email — the dedupe check. */
export async function findPendingInviteByEmail(
  email: string,
): Promise<InviteRow | null> {
  const rows = await db
    .select()
    .from(invites)
    .where(
      and(
        eq(invites.email, email),
        isNull(invites.acceptedAt),
        isNull(invites.revokedAt),
      ),
    )
    .orderBy(desc(invites.createdAt))
    .limit(1);
  const row = rows[0];
  return row !== undefined && inviteStatus(row) === "pending" ? row : null;
}

/**
 * Provision the AuthKit user for an accepted invite — idempotent.
 * Existing user (any auth method) is reused; a new user is created with
 * `emailVerified: true`: possession of the founder-issued invite code is
 * the admission proof for this internal tool, and skipping AuthKit's
 * email-verification interstitial is exactly what keeps the flow on our
 * own screens. OAuth providers re-verify the mailbox anyway.
 */
export async function ensureWorkosUser(input: {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
}): Promise<{ userId: string; created: boolean }> {
  const workos = getWorkOS();
  const existing = await workos.userManagement.listUsers({
    email: input.email,
  });
  const found = existing.data[0];
  if (found !== undefined) {
    return { userId: found.id, created: false };
  }
  const created = await workos.userManagement.createUser({
    email: input.email,
    password: input.password,
    firstName: input.firstName,
    lastName: input.lastName,
    emailVerified: true,
  });
  return { userId: created.id, created: true };
}

/** The password path signs the new user straight in (no second form). */
export async function authenticateInvitee(input: {
  email: string;
  password: string;
}) {
  return getWorkOS().userManagement.authenticateWithPassword({
    clientId,
    email: input.email,
    password: input.password,
  });
}

export async function markInviteAccepted(
  id: string,
  workosUserId: string,
): Promise<void> {
  await db
    .update(invites)
    .set({ acceptedAt: new Date(), workosUserId, updatedAt: new Date() })
    .where(eq(invites.id, id));
}
