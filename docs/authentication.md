# Authentication

> **For LLMs**: Auth uses WorkOS AuthKit with a custom login UI. Social logins (Google, Apple) redirect directly to providers via `@workos-inc/node` SDK — NOT through the WorkOS hosted page. The callback uses a custom handler (`authenticateWithCode` + `saveSession`), NOT `handleAuth` (which requires PKCE state). After WorkOS auth, `AuthSync` exchanges the WorkOS user for a backend JWT via `POST /auth/workos/exchange`.

---

## Overview

Two-phase authentication:

1. **WorkOS** handles identity (OAuth, email/password, SSO)
2. **Backend** issues a JWT for API access via token exchange

```
User → Custom Login UI → WorkOS OAuth → /callback → AuthSync → Backend JWT → App
```

---

## Login Page

**File**: `src/app/(auth)/login/page.tsx`

Custom-designed login page with animated gradient canvas background (Stripe-inspired). No WorkOS hosted UI shown directly to users.

### Button Routing

| Button              | Route / Action         | Behavior                                         |
| ------------------- | ---------------------- | ------------------------------------------------ |
| Sign in (form)      | `emailPasswordLogin()` | Server action: WorkOS `authenticateWithPassword` |
| Sign in with Google | `/login/google`        | Direct Google OAuth (skips WorkOS UI)            |
| Sign in with Apple  | `/login/apple`         | Direct Apple OAuth (skips WorkOS UI)             |
| Forgot password     | `/forgot-password`     | Password reset email via WorkOS                  |
| Create account      | `/signup`              | Email/password signup via WorkOS                 |

### Provider Route Handlers

```
src/app/(auth)/login/
├── page.tsx              # Custom login UI
├── redirect/route.ts     # getSignInUrl() → WorkOS hosted page
├── google/route.ts       # getAuthorizationUrl({ provider: "GoogleOAuth" })
└── github/route.ts       # getAuthorizationUrl({ provider: "GitHubOAuth" })
```

**Google/GitHub** use `@workos-inc/node` SDK directly:

```typescript
// src/app/(auth)/login/google/route.ts
import { workos, clientId, redirectUri } from "@/lib/workos";

export async function GET() {
  const url = workos.userManagement.getAuthorizationUrl({
    provider: "GoogleOAuth",
    clientId,
    redirectUri,
  });
  redirect(url);
}
```

**Shared WorkOS instance**: `src/lib/workos.ts`

```typescript
import { WorkOS } from "@workos-inc/node";
export const workos = new WorkOS(process.env.WORKOS_API_KEY);
export const clientId = process.env.WORKOS_CLIENT_ID!;
export const redirectUri = process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI!;
```

---

## OAuth Callback

**File**: `src/app/(auth)/callback/route.ts`

```typescript
import { saveSession, getWorkOS } from "@workos-inc/authkit-nextjs";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const authResponse = await getWorkOS().userManagement.authenticateWithCode({ code, clientId });
  await saveSession(authResponse, request);
  return NextResponse.redirect(new URL("/chat", request.url));
}
```

Uses a **custom handler** instead of `handleAuth`. Why: `handleAuth` in authkit-nextjs v3 requires PKCE state (set by `getSignInUrl`), but our OAuth routes use `getAuthorizationUrl` for direct provider redirects which doesn't set PKCE state. The custom handler exchanges the code and saves the session manually.

**DO NOT replace with `handleAuth`** — it will break Google/Apple sign-in with "OAuth state mismatch" errors.

---

## Proxy (Middleware)

**File**: `src/proxy.ts`

Uses `authkitProxy` from `@workos-inc/authkit-nextjs` to protect routes. **DO NOT** wrap this in a function, use `authkitMiddleware`, or change the export pattern — any modification breaks the OAuth callback cookie flow.

Mock auth bypass: `MOCK_AUTH=true` (server-only env var) sets `middlewareAuth.enabled: false`.

### Unauthenticated Paths

```typescript
unauthenticatedPaths: [
  "/",
  "/login",
  "/login/redirect",
  "/login/google",
  "/login/github",
  "/callback",
  "/logout",
  "/unauthorized",
  "/help",
  "/terms",
  "/privacy",
  "/docs",
  "/docs/(.*)",
  "/sitemap.xml",
  "/robots.txt",
  "/manifest.webmanifest",
];
```

**Mock auth**: When `MOCK_AUTH=true` (server-only env var, set by `npm run dev:mock` or Playwright), `middlewareAuth.enabled` is `false` — no redirect to login. Layout mounts `E2EAuthInit` instead of `AuthKitProvider`.

**Critical**: Proxy must be at `src/proxy.ts` (same level as `src/app/`).

---

## Token Exchange (AuthSync)

**File**: `src/queries/auth/use-auth-sync.ts`

After WorkOS sets session cookies, `AuthSync` (rendered in root layout) bridges to the backend:

```
1. AuthKitProvider provides WorkOS user data
2. useAuthSync() detects authenticated WorkOS session
3. POST /auth/workos/exchange { workos_user_id, email, full_name, avatar_url }
4. Backend returns: { accessToken, user, accountId, role, needsOnboarding }
5. accessToken stored in localStorage (friendly_fortnight_token)
6. User data stored in Zustand auth.store
```

### Token Storage

| Storage           | Key                        | Value                                          |
| ----------------- | -------------------------- | ---------------------------------------------- |
| localStorage      | `friendly_fortnight_token` | Backend JWT (for API calls)                    |
| Cookie (httpOnly) | `wos-session`              | WorkOS encrypted session (set by `saveSession`) |
| Zustand           | `auth.store`               | User object, loading state, onboarding flag    |

### API Authorization

All backend API calls use the JWT:

```typescript
// src/lib/authTokenManager.ts
class AuthTokenManager {
  getAuthHeaders(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}
```

---

## Logout

**File**: `src/app/(auth)/logout/route.ts`

```typescript
import { signOut } from "@workos-inc/authkit-nextjs";
export const GET = async () => signOut();
```

Zustand store also clears local state:

```typescript
logout: () => {
  authService.removeToken(); // Clear localStorage JWT
  set(initialState); // Reset Zustand state
  window.location.href = "/logout"; // Trigger WorkOS signOut
};
```

---

## Session Expiration

When API calls return 401:

1. `authTokenManager.clearTokenOnUnauthorized()` removes the JWT
2. Dispatches `"auth:session-expired"` custom event
3. `useAuthSync()` listens for this event and resets Zustand state
4. User is redirected to login

---

## Files

| File                                        | Purpose                                   |
| ------------------------------------------- | ----------------------------------------- |
| `src/app/(auth)/layout.tsx`                 | Shared auth layout (canvas, card, footer) |
| `src/app/(auth)/login/page.tsx`             | Sign in (email/password + social)         |
| `src/app/(auth)/login/actions.ts`           | `emailPasswordLogin` server action        |
| `src/app/(auth)/login/google/route.ts`      | Direct Google OAuth                       |
| `src/app/(auth)/login/apple/route.ts`       | Direct Apple OAuth                        |
| `src/app/(auth)/signup/page.tsx`            | Create account (form + Google)            |
| `src/app/(auth)/signup/actions.ts`          | `createAccount` server action             |
| `src/app/(auth)/forgot-password/page.tsx`   | Password reset request + confirmation     |
| `src/app/(auth)/forgot-password/actions.ts` | `sendPasswordReset` server action         |
| `src/app/(auth)/complete-signup/page.tsx`   | OAuth signup completion (backup pw)       |
| `src/app/(auth)/complete-signup/actions.ts` | `completeSignup` server action            |
| `src/app/(auth)/link-account/page.tsx`      | Link OAuth to existing account            |
| `src/app/(auth)/link-account/actions.ts`    | `confirmLinkAccount` server action        |
| `src/app/(auth)/callback/route.ts`          | OAuth callback handler                    |
| `src/app/(auth)/logout/route.ts`            | Logout + session clear                    |
| `src/components/auth/BrandHeader.tsx`       | Shared mobile/desktop logo header         |
| `src/components/auth/PasswordInput.tsx`     | Password field with strength + toggle     |
| `src/components/auth/CountrySelect.tsx`     | Country dropdown with flags               |
| `src/lib/workos.ts`                         | Shared WorkOS SDK instance                |
| `src/lib/authTokenManager.ts`               | localStorage JWT manager                  |
| `src/stores/auth.store.ts`                  | Zustand auth state                        |
| `src/stores/use-auth.ts`                    | `useAuth()` hook                          |
| `src/queries/auth/use-auth-sync.ts`         | WorkOS → Backend token exchange           |
| `src/queries/auth/AuthSync.tsx`             | Invisible sync component (root layout)    |
| `src/proxy.ts`                              | WorkOS middleware                         |

---

## Environment Variables

| Variable                          | Required | Purpose                               |
| --------------------------------- | -------- | ------------------------------------- |
| `WORKOS_API_KEY`                  | Yes      | Server-side WorkOS API calls          |
| `WORKOS_CLIENT_ID`                | Yes      | OAuth client identifier               |
| `WORKOS_COOKIE_PASSWORD`          | Yes      | Session cookie encryption (32+ chars) |
| `NEXT_PUBLIC_WORKOS_REDIRECT_URI` | Yes      | OAuth callback URL (`/callback`)      |
| `MOCK_AUTH`                       | No       | Disable auth for E2E/dev (`npm run dev:mock`) |

---

## Invariants

- **Middleware location**: Must be at `src/proxy.ts` (not project root) — see CLAUDE.md
- **No WorkOS hosted UI**: All auth pages are custom — email/password uses server actions, social uses direct OAuth via `getAuthorizationUrl`
- **Three coupled pieces**: `getAuthorizationUrl` (routes) + custom `authenticateWithCode` callback + plain `authkitProxy` proxy — changing one breaks the others
- **Token exchange required**: WorkOS auth alone is not enough — backend JWT needed for all API calls
- **Shared components**: `BrandHeader` (mobile/desktop logo), `PasswordInput` (strength + toggle), `CountrySelect` (flags) — reused across all auth pages
- **Session cookies are httpOnly**: Frontend cannot read `wos-session` — only proxy can
- **Mock auth**: `MOCK_AUTH=true` (server-only) disables proxy auth + mounts `E2EAuthInit` in layout
