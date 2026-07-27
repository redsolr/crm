/** Single source of truth for the backend host. */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8080";

/**
 * Pinned platform API version per `docs/platform/api-discipline.md` § B2.
 *
 * Sent as the `Jurisimus-Version` header on every request through
 * `BaseApiClient`. Pinning explicitly (rather than floating on the
 * platform default) means new dated versions can ship without silently
 * changing this app's behavior — when we want a newer version, we bump
 * this constant and exercise the diff intentionally.
 */
export const API_VERSION = "2026-04-24.basil";

/**
 * Versioned API root. All public platform endpoints are mounted under
 * `/v1/`; only the explicitly-excluded paths (auth, oauth, .well-known,
 * mcp, webhooks, payments/webhooks, subscriptions/webhook,
 * collaboration, health) bypass the prefix. Use `API_BASE` directly for
 * those, and `API_V1` for everything else.
 */
export const API_V1 = `${API_BASE}/v1`;
