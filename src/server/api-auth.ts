import type { NextResponse } from "next/server";
import { apiError } from "./api-error";
import { currentActor, type RequestActor } from "./actor";
import { LOCAL_ACTOR_ID } from "./constants";

/**
 * Authorization gate for the data-plane API (2026-08-08).
 *
 * **The hole this closes**: `currentActor()` resolves WHO is writing and
 * FALLS BACK to the local placeholder actor when there is no session —
 * correct for attribution, catastrophic as an implicit authorization
 * decision. Every `/api/*` route inherited that fallback and therefore
 * served anonymous callers: verified live on prod, reads returned real
 * records (including Ask chat history) and writes reached validation.
 * Auth enforcement was documented but never existed; `proxy.ts` runs
 * with `middlewareAuth.enabled:false` by design (custom login UI), so
 * nothing gated the API layer.
 *
 * The pattern here is not new — `api/realtime/session` and
 * `server/invites.ts` already refuse the fallback actor outside
 * MOCK_AUTH. This lifts that rule into one seam every route calls.
 *
 * MOCK_AUTH is honored ONLY outside a production build, so the e2e
 * escape hatch can never open a deployed environment (dev/prod parity:
 * the mocked + integration tiers run `next dev`).
 *
 * Usage — first two lines of every data-plane handler:
 *
 *     const gate = await requireApiSession();
 *     if (!gate.ok) return gate.response;
 *
 * Enforced by `src/__tests__/api-auth-coverage.test.ts`, which fails CI
 * if a route handler ships without the gate and isn't on the exempt
 * list there.
 */

export type ApiSessionGate =
  | { ok: true; actor: RequestActor }
  | { ok: false; response: NextResponse };

/** True when the caller proved a real identity (or is a local mock run). */
export function isAuthenticatedActor(actor: RequestActor): boolean {
  if (actor.id !== LOCAL_ACTOR_ID) return true;
  return (
    process.env.MOCK_AUTH === "true" && process.env.NODE_ENV !== "production"
  );
}

export async function requireApiSession(): Promise<ApiSessionGate> {
  const actor = await currentActor();
  if (!isAuthenticatedActor(actor)) {
    return {
      ok: false,
      response: apiError(
        401,
        "unauthorized",
        "Authentication required — sign in to the CRM.",
      ),
    };
  }
  return { ok: true, actor };
}
