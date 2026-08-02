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
 * method) — never tokens. Survives logout by design; "Use another
 * account" on the login page clears it.
 */

export const LAST_ACCOUNT_COOKIE = "crm-last-account";
export const LAST_ACCOUNT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export interface LastAccount {
  email: string;
  name?: string;
  /** WorkOS AuthenticationMethod, e.g. "GoogleOAuth" | "AppleOAuth" | "Password". */
  method?: string;
}

/** Cookie value for a last account (shared by the server write paths). */
export function serializeLastAccount(account: LastAccount): string {
  return encodeURIComponent(JSON.stringify(account));
}

export function parseLastAccount(cookieValue: string): LastAccount | null {
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(cookieValue));
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
  } catch (error) {
    console.warn("[last-account] failed to parse cookie value:", error);
    return null;
  }
}

/** Read the last signed-in account from `document.cookie` (client only). */
export function readLastAccount(): LastAccount | null {
  const entry = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${LAST_ACCOUNT_COOKIE}=`));
  if (entry === undefined) return null;
  return parseLastAccount(entry.slice(LAST_ACCOUNT_COOKIE.length + 1));
}

/** Forget the last account ("Use another account" on the login page). */
export function clearLastAccount(): void {
  document.cookie = `${LAST_ACCOUNT_COOKIE}=; path=/; max-age=0`;
}
