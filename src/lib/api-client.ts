import * as Sentry from "@sentry/nextjs";
import { authService } from "./authTokenManager";
import { API_BASE, API_V1, API_VERSION } from "@/lib/api-base";
import { getWorkspaceOverride } from "./workspace-override";
import { notifyTermsGate403 } from "./terms/gate-events";

const NON_MUTATING_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Build the `X-CSRF-Token` header for state-changing requests by
 * reflecting the `jurisimus_csrf` cookie value (set by the BE on
 * login/refresh/exchange). Returns `{}` for safe methods (GET / HEAD /
 * OPTIONS) and when the cookie isn't readable — the BE's CSRF
 * middleware skips those branches anyway. The header is always safe
 * to send when a value exists; over-attaching is a no-op for non-
 * mutating routes.
 */
function buildCsrfHeader(method?: string): Record<string, string> {
  const m = (method ?? "GET").toUpperCase();
  if (NON_MUTATING_METHODS.has(m)) return {};
  const token = authService.getCsrfToken();
  return token === null ? {} : { "X-CSRF-Token": token };
}

/**
 * Structured error thrown by the API client. Preserves the backend response
 * body so call sites can branch on `code` (e.g. `PERMISSION_DENIED`,
 * `VALIDATION_FAILED`) and surface the real `message` to users instead of
 * the generic "HTTP error! status: 403" placeholder.
 *
 * The backend always returns a JSON body of the shape produced by
 * `HttpExceptionFilter` in the platform — see
 * `src/common/filters/http-exception.filter.ts` for the contract:
 *   {
 *     statusCode: number,
 *     error: string,
 *     code?: string,           // present for guard rejections
 *     message: string,
 *     action?: string,         // present for PERMISSION_DENIED
 *     resource?: string,       // present for PERMISSION_DENIED
 *     details?: unknown,       // present for validation errors
 *     timestamp: string,
 *   }
 *
 * `instanceof ApiError` is the recommended check at call sites; falling back
 * to `err.message` works for legacy catch handlers because we extend `Error`.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly action?: string;
  readonly resource?: string;
  readonly details?: unknown;
  readonly body?: unknown;

  constructor(init: {
    status: number;
    code: string;
    message: string;
    action?: string;
    resource?: string;
    details?: unknown;
    body?: unknown;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.action = init.action;
    this.resource = init.resource;
    this.details = init.details;
    this.body = init.body;
  }
}

/**
 * Read a fetch Response and produce an ApiError that preserves the backend's
 * structured fields. Best-effort: if the body is not JSON or already
 * consumed, falls back to status text and a synthetic code.
 *
 * Exported so the duplicate fetch wrappers in `chat/client.ts` and
 * `findingsApi.ts` can use the same pattern without re-implementing it.
 *
 * Terms-acceptance gate: a 403 with `terms_acceptance_required` means
 * the platform blocks the whole `/v1/*` surface until acceptance. The
 * detection lives HERE — the one choke point every error path shares
 * (BaseApiClient AND the raw-fetch wrappers: ui-layout hydrate, chat
 * history, findings) — so any gated call routes the user to
 * `/accept-terms` via `TermsGateListener` (or opens the ai_ack modal
 * when the 403 is solely the first-AI-use acknowledgment).
 */
export async function buildApiError(response: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Body was not JSON or already consumed by an earlier read — fall through
    // and synthesize an error from the status alone.
  }

  if (response.status === 403) {
    notifyTermsGate403(body);
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const nestedError =
    typeof b.error === "object" && b.error !== null
      ? (b.error as Record<string, unknown>)
      : undefined;

  const code =
    (typeof b.code === "string" ? b.code : undefined) ??
    (typeof nestedError?.code === "string" ? nestedError.code : undefined) ??
    `HTTP_${response.status}`;

  const message =
    (typeof b.message === "string" ? b.message : undefined) ??
    (typeof nestedError?.message === "string"
      ? nestedError.message
      : undefined) ??
    response.statusText ??
    `HTTP ${response.status}`;

  return new ApiError({
    status: response.status,
    code,
    message,
    action: typeof b.action === "string" ? b.action : undefined,
    resource: typeof b.resource === "string" ? b.resource : undefined,
    details: b.details ?? b.errors,
    body,
  });
}

/**
 * Base API client that handles auth headers, token refresh, rate limit retry,
 * 204 No Content, and standard error responses.
 *
 * All domain API clients should extend this class. The `baseUrl` is
 * pinned to `${API_BASE}/v1` per the platform's `/v1/` URL discipline
 * (`docs/platform/api-discipline.md` § B2); subclasses pass paths like
 * `/work_items` and the prefix is applied transparently. Endpoints
 * explicitly excluded from `/v1/` (auth, oauth, webhooks, health, ...)
 * must use `API_BASE` directly — see the `auth/refresh` call below for
 * the canonical pattern.
 *
 * Every request also carries `Jurisimus-Version: ${API_VERSION}` so the
 * platform's date-stamped minor version is pinned explicitly rather than
 * floating on the platform default.
 */
export class BaseApiClient {
  protected baseUrl = API_V1;

  private static refreshPromise: Promise<"ok" | "dead" | "transient"> | null =
    null;

  /**
   * Attempt to refresh the access token using the stored refresh
   * token. Deduplicates concurrent refresh attempts. Returns
   * `"ok"` on success, `"dead"` when the refresh endpoint
   * specifically returns 401 (the refresh token is genuinely
   * invalidated — caller should force-logout), or `"transient"`
   * for any other failure (network, 422 from a wire-shape bug,
   * 500 server error, missing refresh token at start). The
   * caller force-logs-out only on `"dead"` so a misconfigured
   * BE or transient error doesn't nuke the session.
   */
  private async tryRefreshToken(): Promise<"ok" | "dead" | "transient"> {
    if (BaseApiClient.refreshPromise) {
      return BaseApiClient.refreshPromise;
    }

    BaseApiClient.refreshPromise = (async () => {
      try {
        // `/auth/*` is excluded from the `/v1/` prefix on the backend
        // (see platform/src/main.ts setGlobalPrefix exclude list), so
        // hit `API_BASE` directly here, not `this.baseUrl`.
        //
        // Cookie-auth path: the refresh token rides as an HttpOnly
        // cookie (`refresh_token`) which the browser includes via
        // `credentials: 'include'`. The BE handler accepts the token
        // from EITHER body or cookie, so we send an empty body. On
        // success, the BE rotates the access + refresh + csrf cookies
        // via `Set-Cookie`; nothing to read off the response body
        // for the FE's purposes — the next `fetch` automatically
        // carries the rotated cookies.
        //
        // CSRF skip: `/auth/refresh` is on the credential-issuance
        // exempt list in `csrf.middleware.ts`, so we don't need to
        // attach `X-CSRF-Token` on the refresh call itself.
        const response = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });

        if (response.status === 401) return "dead" as const;
        if (!response.ok) return "transient" as const;
        return "ok" as const;
      } catch (err) {
        // Network failure / malformed response — treat as transient
        // so the caller surfaces the 401 to the consumer instead of
        // forcing a logout on every flaky network blip.
        console.error("[BaseApiClient] token refresh failed:", err);
        return "transient" as const;
      }
    })().finally(() => {
      BaseApiClient.refreshPromise = null;
    });

    return BaseApiClient.refreshPromise;
  }

  protected async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0,
  ): Promise<T> {
    return this.requestAtUrl<T>(
      `${this.baseUrl}${endpoint}`,
      endpoint,
      options,
      retryCount,
    );
  }

  /**
   * Variant of `request()` for endpoints intentionally mounted OUTSIDE
   * the `/v1/` prefix (currently `/auth/*`, `/oauth/*`, `/webhooks/*`,
   * `/health` per the platform's `setGlobalPrefix` exclude list).
   *
   * Same retry / refresh / error-envelope logic as `request()` — the
   * only difference is `${API_BASE}${endpoint}` instead of
   * `${API_BASE}/v1${endpoint}`. Inline `fetch` calls to these routes
   * lose 429/503 backoff and the 401-refresh-then-retry behavior.
   */
  protected async requestUnprefixed<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0,
  ): Promise<T> {
    return this.requestAtUrl<T>(
      `${API_BASE}${endpoint}`,
      endpoint,
      options,
      retryCount,
    );
  }

  /**
   * Shared transport for `request()` and `requestUnprefixed()`. The
   * `endpoint` parameter is forwarded to Sentry tags + retry recursion;
   * `url` is the fully-built URL the actual fetch hits.
   */
  private async requestAtUrl<T>(
    url: string,
    endpoint: string,
    options: RequestInit,
    retryCount: number,
  ): Promise<T> {
    // The JWT binds a default workspace at login; the CRM's sidebar
    // switcher selects among per-product workspaces (ADR-001), so
    // every `/v1/*` call carries the selected workspace via
    // `Jurisimus-Workspace-Id` (api-discipline § Workspace switcher —
    // honored on JWT/PAT requests). Without it, RLS keeps serving the
    // JWT-bound workspace no matter which workspace_id the path/query
    // names. Explicit per-call headers still win (Object.assign last).
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Jurisimus-Version": API_VERSION,
      ...buildCsrfHeader(options.method),
    };
    const workspaceOverride = getWorkspaceOverride();
    if (workspaceOverride) {
      headers["Jurisimus-Workspace-Id"] = workspaceOverride;
    }
    Object.assign(headers, options.headers);

    const response = await fetch(url, {
      ...options,
      // `credentials: 'include'` makes the browser attach the
      // HttpOnly `access_token`, `refresh_token`, and JS-readable
      // `jurisimus_csrf` cookies on every request. Required for the
      // cookie-auth path; harmless for non-browser callers since
      // `fetch` inside Node ignores the option.
      credentials: "include",
      headers,
    });

    if (!response.ok) {
      // Rate limited — retry with exponential backoff using Retry-After header
      if (response.status === 429 && retryCount < 3) {
        const retryAfter = response.headers.get("Retry-After");
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.min(1000 * 2 ** retryCount, 30000);

        await new Promise((r) => setTimeout(r, delay));
        return this.requestAtUrl<T>(url, endpoint, options, retryCount + 1);
      }

      // Transient backend unavailability — typically a Fargate Spot reclaim
      // on dev (the ALB returns 503 for ~2min while tasks rotate). Retry
      // with short backoff (500ms / 1s / 2s); shares the 3-retry budget
      // with the 429 path. Honor Retry-After when present.
      if (response.status === 503 && retryCount < 3) {
        const retryAfter = response.headers.get("Retry-After");
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.min(500 * 2 ** retryCount, 5000);

        await new Promise((r) => setTimeout(r, delay));
        return this.requestAtUrl<T>(url, endpoint, options, retryCount + 1);
      }

      if (response.status === 401) {
        const refreshState = await this.tryRefreshToken();
        if (refreshState === "ok") {
          // Retry the original request — the BE rotated the cookies
          // on `/auth/refresh`, so the next `fetch` picks them up
          // automatically via `credentials: 'include'`. Re-build the
          // CSRF header (the rotated `jurisimus_csrf` cookie value
          // differs from the prior).
          const retryHeaders: HeadersInit = {
            "Content-Type": "application/json",
            "Jurisimus-Version": API_VERSION,
            ...buildCsrfHeader(options.method),
            ...options.headers,
          };
          const retryResponse = await fetch(url, {
            ...options,
            credentials: "include",
            headers: retryHeaders,
          });

          if (retryResponse.ok) {
            if (retryResponse.status === 204) return undefined as T;
            return retryResponse.json();
          }
        }

        // Force-logout ONLY when the refresh endpoint itself
        // returned 401 (the refresh token is genuinely dead).
        // `transient` (network blip, BE misconfig, missing refresh
        // token at start) surfaces the original 401 to the caller
        // as a structured error without nuking the session — the
        // user can keep working in the rest of the app even if a
        // single endpoint is misbehaving.
        if (refreshState === "dead") {
          authService.notifySessionExpired();
        }
      }

      // Every non-OK status produces a structured ApiError that preserves
      // the backend's `{ error: { type, code, message, request_id } }`
      // envelope. Callers branch on `err.status` / `err.code` (ApiError
      // extends Error, so `err.message` still works for legacy handlers).
      // Terms-gate 403s are detected inside buildApiError (the shared
      // choke point) — the error still propagates so callers render
      // their own failure state while navigation happens.
      const err = await buildApiError(response);

      // Capture 5xx server errors to Sentry with request context.
      if (response.status >= 500) {
        Sentry.captureException(err, {
          tags: { endpoint, statusCode: response.status, code: err.code },
        });
      }
      throw err;
    }

    if (response.status === 204) {
      return undefined as T;
    }

    return response.json();
  }
}
