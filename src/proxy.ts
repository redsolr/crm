/**
 * ============================================================================
 * Next.js 16 proxy — WorkOS AuthKit
 * ============================================================================
 *
 * Under `MOCK_AUTH=true` (server-only env var, set by `npm run dev:mock`
 * or Playwright's webServer.env), layout.tsx mounts MockAuthInit instead
 * of AuthKitProvider to hydrate auth from localStorage.
 *
 * DO NOT wrap, rename, or conditionally export authkitProxy. Any change to
 * the export pattern breaks the OAuth callback cookie-setting flow.
 *
 * Auth enforcement does NOT live here — see the `middlewareAuth.enabled:
 * false` rationale on the export below. Route protection is `ProtectedRoute`
 * (client) + backend cookie guards (server).
 * ============================================================================
 */

import { authkitProxy } from "@workos-inc/authkit-nextjs";

/**
 * `middlewareAuth.enabled` is FALSE by design (2026-07-08).
 *
 * Jurisimus runs a fully CUSTOM login (`/login` + direct-to-provider
 * OAuth via `getAuthorizationUrl`), never the WorkOS hosted AuthKit
 * screen. `enabled: true` is the ONLY thing that auto-redirects a
 * protected path to `getSignInUrl()` (the hosted screen) — and
 * authkit-nextjs offers no config to point that redirect at our own
 * `/login`. So we disable it and enforce auth ourselves:
 *   - client: `ProtectedRoute` gates every `(app)` route → `/login`
 *     (renders a spinner, never protected content, until auth resolves);
 *   - server: the backend cookie-guards every `/v1/*` call (401 →
 *     api-client redirects), so data is never shipped to an anon user.
 * The proxy still runs on every request for SESSION REFRESH + header
 * injection; only the redirect-to-hosted behavior is off — the same
 * enforcement model mock-auth dev already ran under.
 *
 * `unauthenticatedPaths` below is retained as living documentation of
 * the public surface (and a one-flip re-enable), but is INERT while
 * `enabled: false` — authkit does not consult it.
 */
export default authkitProxy({
  middlewareAuth: {
    enabled: false,
    unauthenticatedPaths: [
      "/",
      "/login",
      "/login/redirect",
      "/login/google",
      "/login/apple",
      "/forgot-password",
      "/signup",
      "/link-account",
      "/complete-signup",
      "/callback",
      "/logout",
      "/unauthorized",
      "/robots.txt",
      "/manifest.webmanifest",
      "/icon",
      "/apple-icon",
      "/opengraph-image",
      "/sw.js",
      "/monitoring",
    ],
  },
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|monitoring|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
