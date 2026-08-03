"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { API_ROOT } from "@/lib/api-base";
import { freshIdempotencyKey } from "@/lib/idempotency";
import { InviteCard, type InviteCardInvite } from "@/components/auth/InviteCard";
import { LoadingDots } from "@/components/shared/LoadingDots";

/**
 * `/invite/<code>` — the owned invite-accept page (rebuilt 2026-08-03;
 * the previous incarnation was fork-era dead code calling platform
 * endpoints this backend never served). Renders inside the (auth)
 * AuthShell like /login, so invitees see the same branded surface the
 * rest of auth uses — never a WorkOS-hosted screen.
 *
 * The page owns the CRM-specific wiring (endpoints, product name) and
 * hands everything else to the kit `InviteCard`.
 */

interface AcceptResponse {
  next?: string;
  message?: string;
}

export default function InviteAcceptPage() {
  const params = useParams();
  const code = params.code as string;

  const [invite, setInvite] = useState<InviteCardInvite | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function validate() {
      try {
        const res = await fetch(`${API_ROOT}/invite/${code}`);
        const data = (await res.json().catch(() => null)) as {
          invite?: InviteCardInvite;
          message?: string;
        } | null;
        if (cancelled) return;
        if (!res.ok || data?.invite === undefined) {
          setLoadError(data?.message ?? "This invite link is invalid.");
          return;
        }
        setInvite(data.invite);
      } catch (err) {
        console.error("[invite] failed to validate invite link:", err);
        if (!cancelled) setLoadError("Could not check this invite — try again.");
      }
    }
    void validate();
    return () => {
      cancelled = true;
    };
  }, [code]);

  async function accept(body: Record<string, unknown>) {
    try {
      const res = await fetch(`${API_ROOT}/invite/${code}/accept`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": freshIdempotencyKey(),
        },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as AcceptResponse | null;
      if (!res.ok || data?.next === undefined) {
        return { error: data?.message ?? "Could not accept the invite." };
      }
      return { next: data.next };
    } catch (err) {
      console.error("[invite] accept failed:", err);
      return { error: "Could not accept the invite — try again." };
    }
  }

  if (loadError !== null) {
    return (
      <div className="invite-invalid" data-testid="invite-invalid">
        <h1 className="text-ctx-primary text-[26px] font-bold">
          Invite not valid
        </h1>
        <p className="text-ctx-body text-[15px] mt-2 opacity-80">{loadError}</p>
        <p className="mt-6">
          <Link
            href="/login"
            className="text-ctx-purple text-[14px] font-semibold"
          >
            Go to sign in
          </Link>
        </p>
      </div>
    );
  }

  if (invite === null) {
    return (
      <div className="invite-loading py-10 flex justify-center">
        <LoadingDots label="Checking invite" />
      </div>
    );
  }

  return (
    <InviteCard
      productName="Jurisimus CRM"
      invite={invite}
      onOAuth={() => accept({ method: "oauth" })}
      onPassword={(fields) => accept({ method: "password", ...fields })}
    />
  );
}
