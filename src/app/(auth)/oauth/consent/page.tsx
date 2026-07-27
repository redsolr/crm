"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { API_BASE } from "@/lib/api-base";
import { authService } from "@/lib/authTokenManager";

/**
 * OAuth 2.1 consent screen for V2 remote MCP.
 *
 * Flow:
 *   1. Arrived here via `GET {API_BASE}/oauth/authorize?...` → 302 with
 *      `?authorize_id=<id>` query param.
 *   2. Fetch client name + scopes from
 *      `GET /oauth/authorize/pending/:id` (JWT-authed).
 *   3. User clicks Approve → POST `/oauth/authorize/complete` →
 *      `{ redirectUrl }` → navigate browser to the client's redirect_uri
 *      with `code` + `state` + `iss`.
 *   4. User clicks Deny → POST `/oauth/authorize/deny` →
 *      `{ redirectUrl }` → navigate to client's redirect_uri with
 *      `error=access_denied`.
 *
 * WorkOS middleware gates this page — if the user isn't logged in, they
 * bounce to /login with `returnPathname` set, and land back here after
 * auth. The local JWT (localStorage) is what actually talks to the backend.
 */
export default function OAuthConsentPage() {
  // `useSearchParams` opts the route out of static prerendering unless
  // it's wrapped in a Suspense boundary — Next.js 16 enforces this at
  // build time. Splitting the inner component keeps the page buildable
  // while preserving the client-side behavior.
  return (
    <Suspense
      fallback={
        <div className="py-6">
          <p className="text-[var(--theme-text-secondary)]">Loading consent request…</p>
        </div>
      }
    >
      <ConsentContent />
    </Suspense>
  );
}

function ConsentContent() {
  const params = useSearchParams();
  const authorizeId = params.get("authorize_id");

  const [pending, setPending] = useState<ConsentPending | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<"approve" | "deny" | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const loadError = !authorizeId ? "Missing authorize_id in URL" : fetchError;

  useEffect(() => {
    if (!authorizeId) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchJsonOrThrow<ConsentPending>(
          `${API_BASE}/oauth/authorize/pending/${encodeURIComponent(authorizeId)}`,
        );
        if (!cancelled) setPending(data);
      } catch (err) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : "Failed to load consent request";
        console.error("[oauth/consent] failed to fetch pending request:", err);
        setFetchError(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authorizeId]);

  async function decide(action: "approve" | "deny") {
    if (!authorizeId) return;
    setSubmitting(action);
    setSubmitError(null);
    try {
      const url =
        action === "approve"
          ? `${API_BASE}/oauth/authorize/complete`
          : `${API_BASE}/oauth/authorize/deny`;
      // BE wire shape is snake_case throughout (Stripe v2 platform
      // convention). Both the request body and the response envelope
      // use snake_case field names.
      const { redirect_url } = await fetchJsonOrThrow<{
        redirect_url: string;
      }>(url, {
        method: "POST",
        body: JSON.stringify({ authorize_id: authorizeId }),
      });
      window.location.href = redirect_url;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to submit consent decision";
      console.error(`[oauth/consent] ${action} failed:`, err);
      setSubmitError(msg);
      setSubmitting(null);
    }
  }

  if (loadError) {
    return (
      <div className="py-6">
        <h1 className="text-xl font-semibold mb-2">Authorization error</h1>
        <p className="text-[var(--theme-text-secondary)]">{loadError}</p>
      </div>
    );
  }

  if (!pending) {
    return (
      <div className="py-6">
        <p className="text-[var(--theme-text-secondary)]">Loading consent request…</p>
      </div>
    );
  }

  return (
    <div className="py-4">
      <h1 className="text-2xl font-semibold mb-1">
        Authorize {pending.client_name}
      </h1>
      <p className="text-[var(--theme-text-secondary)] text-sm mb-6">
        <span className="font-mono">{pending.client_name}</span> is requesting
        access to your Jurisimus project. Review the permissions below.
      </p>

      <div className="rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-bg-tertiary)] p-4 mb-5">
        <div className="text-xs font-semibold uppercase text-[var(--theme-text-muted)] mb-2">
          Permissions requested
        </div>
        <ul className="space-y-2">
          {pending.scope.map((scope) => (
            <li key={scope} className="flex gap-2 items-start">
              <span className="mt-0.5 text-green-600">✓</span>
              <span className="text-sm text-[var(--theme-text-primary)]">
                {describeScope(scope)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="text-xs text-[var(--theme-text-muted)] mb-5">
        After you approve, you&apos;ll be sent back to{" "}
        <span className="font-mono break-all">{pending.redirect_uri}</span>.
      </div>

      {submitError && (
        <div className="mb-4 rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {submitError}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          className="flex-1 rounded-lg bg-blue-600 text-white font-semibold py-2.5 hover:bg-blue-700 disabled:opacity-50"
          disabled={submitting !== null}
          onClick={() => {
            void decide("approve");
          }}
        >
          {submitting === "approve" ? "Approving…" : "Approve"}
        </button>
        <button
          type="button"
          className="flex-1 rounded-lg border border-[var(--theme-border-secondary)] text-[var(--theme-text-primary)] font-semibold py-2.5 hover:bg-[var(--theme-bg-hover)] disabled:opacity-50"
          disabled={submitting !== null}
          onClick={() => {
            void decide("deny");
          }}
        >
          {submitting === "deny" ? "Denying…" : "Deny"}
        </button>
      </div>
    </div>
  );
}

interface ConsentPending {
  // Snake_case mirrors the BE wire shape exactly
  // (`ConsentPendingResponseDto` in
  // `platform/src/modules/oauth/authorize.response.dto.ts`). Don't
  // camelize here — Stripe v2 platform convention is snake_case
  // throughout, and the consumer page is the canonical example to
  // mirror that.
  authorize_id: string;
  client_id: string;
  client_name: string;
  redirect_uri: string;
  scope: string[];
  resource: string | null;
  expires_at: string;
}

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  "jurisimus.read":
    "Read your tasks, plans, notes, and search your project",
  "jurisimus.write":
    "Create and update tasks; propose sprints, retros, and grooming",
  "jurisimus.admin": "Manage API tokens and billing",
};

function describeScope(scope: string): string {
  return SCOPE_DESCRIPTIONS[scope] ?? scope;
}

/**
 * Send a JSON request to a fully-qualified URL and parse the response,
 * throwing the server's `message` (or `HTTP <status>`) on non-2xx.
 *
 * Caller passes the absolute URL (including `${API_BASE}` prefix) so
 * source-walking tooling — the public-API coverage ratchet in
 * particular — can statically resolve the path. Building the URL inside
 * a helper out of a string parameter would hide it from the walker.
 */
async function fetchJsonOrThrow<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const csrf = authService.getCsrfToken();
  const method = (init.method ?? "GET").toUpperCase();
  const isMutating = method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(isMutating && csrf !== null ? { "X-CSRF-Token": csrf } : {}),
    ...(init.headers ?? {}),
  };
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    headers,
  });
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as { message?: string };
      if (typeof body?.message === "string") message = body.message;
    } catch (parseErr) {
      console.warn("[oauth/consent] non-JSON error body:", parseErr);
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}
