/**
 * Collaboration WebSocket tickets — `POST /auth/ws_ticket` mints a
 * single-use `wst_*` ticket (60s TTL) off the browser's cookie session.
 * Tickets are SINGLE-USE (atomic GETDEL server-side), so every
 * connection attempt — including provider reconnects — must mint a
 * fresh one; pass `mintWsTicket` as the provider's async `token`
 * factory, never a cached string.
 */

import { API_BASE } from "@/lib/api-base";
import { authService } from "@/lib/authTokenManager";

export async function mintWsTicket(): Promise<string> {
  const csrf = authService.getCsrfToken();
  const res = await fetch(`${API_BASE}/auth/ws_ticket`, {
    method: "POST",
    credentials: "include",
    headers: csrf === null ? {} : { "X-CSRF-Token": csrf },
  });
  if (!res.ok) {
    throw new Error(`ws_ticket mint failed: HTTP ${res.status}`);
  }
  const body = (await res.json()) as { ticket: string };
  return body.ticket;
}

/** ws(s):// address of the collaboration endpoint, derived from API_BASE. */
export function collaborationUrl(): string {
  return `${API_BASE.replace(/^http/, "ws")}/collaboration`;
}
