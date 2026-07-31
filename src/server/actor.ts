import { withAuth } from "@workos-inc/authkit-nextjs";
import { LOCAL_ACTOR_ID } from "./constants";

/**
 * Resolve WHO is performing the current request — the swap's "step 6"
 * (real user identity on writes), landed 2026-07-31 for team readiness:
 * with more than one human seat, every write must carry its real
 * author, not the blended `usr_local` placeholder.
 *
 * Source of truth is the AuthKit session (`withAuth` reads the headers
 * `authkitProxy` attaches on every request — see `src/proxy.ts`).
 * Fallback to the local placeholder actor covers every legitimate
 * session-less caller: `MOCK_AUTH` dev/e2e (no AuthKit session exists),
 * and the `/mcp` door (bearer-authed, no cookie — its writes are
 * stamped with the agent identity by the tools themselves, not by this
 * resolver).
 */

export interface RequestActor {
  id: string;
  /** Display name (falls back to the email's local part, then null). */
  name: string | null;
  email: string | null;
}

export const LOCAL_FALLBACK_ACTOR: RequestActor = {
  id: LOCAL_ACTOR_ID,
  name: null,
  email: "local@crm.internal",
};

/** Project a request actor into the `logActivity` actor shape (human
 *  writes — agent surfaces build their own with type "agent"). */
export function asActivityActor(actor: RequestActor): {
  id: string;
  type: "user";
  name: string | null;
} {
  return { id: actor.id, type: "user", name: actor.name };
}

export async function currentActor(): Promise<RequestActor> {
  try {
    const { user } = await withAuth();
    if (!user) return LOCAL_FALLBACK_ACTOR;
    const fullName = [user.firstName, user.lastName]
      .filter(Boolean)
      .join(" ");
    return {
      id: user.id,
      name: fullName !== "" ? fullName : (user.email?.split("@")[0] ?? null),
      email: user.email ?? null,
    };
  } catch {
    // withAuth throws when the request never passed through the proxy
    // (unit tests calling handlers directly) — same answer as "no
    // session".
    return LOCAL_FALLBACK_ACTOR;
  }
}
