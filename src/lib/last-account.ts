/**
 * "Continue as <last account>" memory for the login page.
 *
 * On every successful sign-in the server writes a NON-httpOnly cookie
 * describing who signed in and how (Google / Apple / password), so the
 * login page can offer that account back after logout — the
 * OpenAI-platform login pattern. Deliberately a cookie rather than
 * localStorage: the OAuth flows never run client JS between the
 * provider redirect and landing in the app, so only the server-side
 * callback knows the identity + method at the right moment.
 *
 * Contains only what the login page displays (email, name, avatar,
 * method) — never tokens. Survives logout by design; signing in with a
 * different account replaces it (no manual clear — founder call
 * 2026-08-03).
 */

export const LAST_ACCOUNT_COOKIE = "crm-last-account";
export const LAST_ACCOUNT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export interface LastAccount {
  email: string;
  name?: string;
  /** WorkOS AuthenticationMethod, e.g. "GoogleOAuth" | "AppleOAuth" | "Password". */
  method?: string;
}

/**
 * Cookie value for a last account (shared by the server write paths).
 *
 * Raw JSON — no pre-encoding. Next's cookie serializer
 * (`ResponseCookies.set`, used by both the callback route and the
 * login server action) URL-encodes the value itself; pre-encoding here
 * produced a DOUBLE-encoded cookie (`%257B…`) that the client's single
 * decode could never read, so the "Continue as" card never showed in
 * prod (2026-08-07 fix).
 */
export function serializeLastAccount(account: LastAccount): string {
  return JSON.stringify(account);
}

/** JSON attempt: the account, `null` for JSON-but-wrong-shape,
 *  `undefined` for not-JSON (caller keeps peeling encoding layers). */
function tryParseAccountJson(value: string): LastAccount | null | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch (error) {
    // Expected while peeling encoding layers — the caller warns once
    // if EVERY layer fails; per-layer misses stay at debug.
    console.debug("[last-account] not JSON at this decoding layer:", error);
    return undefined;
  }
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    typeof (parsed as { email?: unknown }).email !== "string" ||
    (parsed as { email: string }).email === ""
  ) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  return {
    email: record.email as string,
    name: typeof record.name === "string" ? record.name : undefined,
    method: typeof record.method === "string" ? record.method : undefined,
  };
}

/**
 * Decode-tolerant parse. Depending on WHICH build wrote the cookie the
 * browser may hold 1 layer of URL-encoding (current: raw JSON, encoded
 * once by Next) or 2 (historical builds pre-encoded before handing to
 * Next's serializer, which encoded again). Peel layers until JSON
 * parses or decoding stops making progress — existing prod cookies
 * stay readable without waiting for the next login to rewrite them.
 */
export function parseLastAccount(cookieValue: string): LastAccount | null {
  let value = cookieValue;
  for (let layer = 0; layer < 3; layer++) {
    const attempt = tryParseAccountJson(value);
    if (attempt !== undefined) return attempt;
    let decoded: string;
    try {
      decoded = decodeURIComponent(value);
    } catch (error) {
      console.warn("[last-account] cookie value is not decodable:", error);
      return null;
    }
    if (decoded === value) break;
    value = decoded;
  }
  console.warn("[last-account] failed to parse cookie value — ignoring it");
  return null;
}

/** Read the last signed-in account from `document.cookie` (client only). */
export function readLastAccount(): LastAccount | null {
  const entry = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${LAST_ACCOUNT_COOKIE}=`));
  if (entry === undefined) return null;
  return parseLastAccount(entry.slice(LAST_ACCOUNT_COOKIE.length + 1));
}

