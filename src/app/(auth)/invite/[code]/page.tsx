"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth.store";
import { API_V1, API_VERSION } from "@/lib/api-base";
import { authService } from "@/lib/authTokenManager";
import { freshIdempotencyKey } from "@/lib/idempotency";
import { INVITE_CODE_STORAGE_KEY } from "@/queries/auth/auth-bridge";

interface InviteInfo {
  account_id: string;
  role: string;
  expiresAt: string | null;
}

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const user = useAuthStore((s) => s.user);

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // Validate the invite code
  useEffect(() => {
    async function validate() {
      try {
        const res = await fetch(`${API_V1}/invite/${code}`, {
          headers: { "Jurisimus-Version": API_VERSION },
        });
        if (!res.ok) {
          const data = await res.json().catch(() => null);
          setError(
            data?.error?.message ?? "This invite link is invalid or expired.",
          );
          return;
        }
        const data = await res.json();
        setInvite(data.invite);
      } catch (err) {
        console.error("[auth/invite] failed to validate invite link", err);
        setError("Failed to validate invite link.");
      } finally {
        setIsLoading(false);
      }
    }
    validate();
  }, [code]);

  const handleAccept = async () => {
    // Cookie-auth: probe the session via /auth/me. If unauth'd, send
    // the user through login first; on return they re-enter this
    // handler with a fresh cookie.
    const authed = await authService.isAuthenticated();
    if (!authed) {
      // Stash the code for the WorkOS exchange (auth-bridge forwards it
      // as `invite_code`). Signup is invitation-only (B2B pivot,
      // 2026-07-06): for a BRAND-NEW identity this is what admits the
      // account past the gate — and the backend accepts the invite
      // server-side, so a new colleague lands directly in the firm.
      // Existing accounts return here via `returnTo` and accept below.
      try {
        window.localStorage.setItem(INVITE_CODE_STORAGE_KEY, code);
      } catch (err) {
        console.error("[auth/invite] could not persist invite code", err);
      }
      router.push(`/login?returnTo=/invite/${code}`);
      return;
    }

    setIsAccepting(true);
    setError(null);

    try {
      const csrf = authService.getCsrfToken();
      const res = await fetch(`${API_V1}/invite/${code}/accept`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "Jurisimus-Version": API_VERSION,
          "Idempotency-Key": freshIdempotencyKey(),
          ...(csrf !== null ? { "X-CSRF-Token": csrf } : {}),
        },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        // 402 `seats_exhausted`: the firm's purchased seats are all in
        // use — the backend message explains it and points the owner
        // to Billing. The flat error envelope (`{ statusCode, error,
        // code, message }`) puts the message at the top level; keep
        // the nested fallback for the `{ error: { message } }` shape.
        setError(
          data?.message ?? data?.error?.message ?? "Failed to accept invite.",
        );
        return;
      }

      setAccepted(true);
      // Redirect to workspace after a short delay
      setTimeout(() => router.push("/"), 1500);
    } catch (err) {
      console.error("[auth/invite] failed to accept invite", err);
      setError("Failed to accept invite.");
    } finally {
      setIsAccepting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--claude-dark)]">
      <div className="w-[400px] bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-primary)] rounded-xl p-8 shadow-2xl text-center">
        {isLoading ? (
          <p className="text-[var(--theme-text-muted)] text-sm">Validating invite...</p>
        ) : error && !invite ? (
          <>
            <div className="text-4xl mb-4">😔</div>
            <h1 className="text-lg font-semibold text-[var(--theme-text-primary)] mb-2">
              Invite Invalid
            </h1>
            <p className="text-sm text-[var(--theme-text-muted)]">{error}</p>
          </>
        ) : accepted ? (
          <>
            <div className="text-4xl mb-4">🎉</div>
            <h1 className="text-lg font-semibold text-[var(--theme-text-primary)] mb-2">
              You&apos;re in!
            </h1>
            <p className="text-sm text-[var(--theme-text-muted)]">
              Redirecting to your project...
            </p>
          </>
        ) : invite ? (
          <>
            <div className="text-4xl mb-4">✉️</div>
            <h1 className="text-lg font-semibold text-[var(--theme-text-primary)] mb-2">
              You&apos;ve been invited
            </h1>
            <p className="text-sm text-[var(--theme-text-muted)] mb-6">
              Join as{" "}
              <span className="text-[var(--theme-text-primary)] font-medium capitalize">
                {invite.role}
              </span>
              {invite.expiresAt && (
                <span className="block mt-1 text-xs">
                  Expires {new Date(invite.expiresAt).toLocaleDateString()}
                </span>
              )}
            </p>

            {error && <p className="text-xs text-red-400 mb-4">{error}</p>}

            {user ? (
              <button
                onClick={handleAccept}
                disabled={isAccepting}
                className="w-full py-2.5 rounded-lg bg-[#3b82f6] text-white font-medium hover:bg-[#2563eb] disabled:opacity-50 transition-colors"
              >
                {isAccepting ? "Joining..." : "Accept Invite"}
              </button>
            ) : (
              <button
                onClick={() => router.push(`/login?returnTo=/invite/${code}`)}
                className="w-full py-2.5 rounded-lg bg-[#3b82f6] text-white font-medium hover:bg-[#2563eb] transition-colors"
              >
                Log in to Accept
              </button>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}
