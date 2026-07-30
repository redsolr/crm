/** Single source of truth for the backend host — this app serves its
 *  own backend, so the fallback is self. */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3100";

/**
 * API root. The CRM serves its own backend from in-repo route handlers
 * mounted under `/api/` — one app, one deploy, both sides of the wire
 * owned here, so there is no URL versioning (the platform-inherited
 * `/v1` prefix and pinned `Jurisimus-Version` header were dropped
 * 2026-07-30). Auth routes (`/auth/*`, `/callback`, …) live outside
 * the prefix; use `API_BASE` directly for those.
 */
export const API_ROOT = `${API_BASE}/api`;
