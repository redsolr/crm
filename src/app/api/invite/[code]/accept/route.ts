import { NextResponse, type NextRequest } from "next/server";
import { saveSession } from "@workos-inc/authkit-nextjs";
import { apiError, readJsonBody } from "@/server/api-error";
import {
  acceptInviteSchema,
  authenticateInvitee,
  ensureWorkosUser,
  findInviteByCode,
  inviteStatus,
  markInviteAccepted,
} from "@/server/invites";

/**
 * `POST /api/invite/:code/accept` — the moment WorkOS becomes a silent
 * backend. Two methods (see `acceptInviteSchema`):
 *
 * - `oauth`: provision the AuthKit user for the invited email (no
 *   password), mark accepted, and answer `{ next: "/login/google?…" }`
 *   — the existing direct-to-provider route finishes sign-in with the
 *   email preselected. Apple works the same via `/login/apple`.
 * - `password`: provision WITH the chosen password, mark accepted,
 *   authenticate immediately and seal the session cookie — the invitee
 *   lands in the app off one form, no second login step.
 *
 * Unauthenticated by design (the code is the capability). Idempotent
 * on the WorkOS side: an existing user for the email is reused, so
 * re-clicking a link never errors with "user exists".
 */

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  const { code } = await context.params;
  const row = await findInviteByCode(code);
  if (row === null || inviteStatus(row) === "revoked") {
    return apiError(404, "invite_not_found", "This invite link is invalid.");
  }
  if (inviteStatus(row) === "expired") {
    return apiError(
      404,
      "invite_expired",
      "This invite has expired — ask for a new one.",
    );
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const parsed = acceptInviteSchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    return apiError(
      422,
      "validation_failed",
      "Request body failed validation",
      parsed.error.issues,
    );
  }
  const body = parsed.data;

  try {
    if (body.method === "oauth") {
      const { userId } = await ensureWorkosUser({ email: row.email });
      await markInviteAccepted(row.id, userId);
      return NextResponse.json({
        next: `/login/google?login_hint=${encodeURIComponent(row.email)}`,
      });
    }

    const { userId, created } = await ensureWorkosUser({
      email: row.email,
      password: body.password,
      firstName: body.first_name,
      lastName: body.last_name,
    });
    if (!created) {
      // The seat already exists — a password chosen NOW must not
      // overwrite it. Point them at normal sign-in instead.
      await markInviteAccepted(row.id, userId);
      return apiError(
        409,
        "user_exists",
        "An account for this email already exists — sign in instead (use 'Forgot your password?' if needed).",
      );
    }
    await markInviteAccepted(row.id, userId);
    const authResponse = await authenticateInvitee({
      email: row.email,
      password: body.password,
    });
    await saveSession(authResponse, request);
    return NextResponse.json({ next: "/sales" });
  } catch (err) {
    console.error(`[invite/accept] failed for invite ${row.id}:`, err);
    return apiError(
      500,
      "accept_failed",
      "Could not activate the seat — try again or ask for a fresh link.",
    );
  }
}
