"use client";

import { useInviteLink } from "@/hooks/use-invite-link";
import { IconCheckCircle } from "@/components/icons";

/**
 * "Invite your teammates" — solo-lawyer-friendly. The real, working action
 * is a shareable invite link (org-scoped, 7-day). We deliberately don't show
 * an email field: there's no email-invite endpoint yet, and a dead input
 * would be worse than none. Solo lawyers skip; firms copy the link.
 */
export function InviteStep({ organizationId }: { organizationId: string | null }) {
  const { copyInviteLink, copied, generating, error } =
    useInviteLink(organizationId);

  return (
    <div className="onboarding-invite space-y-4">
      <button
        type="button"
        onClick={() => void copyInviteLink()}
        disabled={generating}
        className="onboarding-invite-copy flex w-full items-center justify-center gap-2 rounded-xl border border-ctx-line px-4 py-3.5 text-sm font-semibold text-gray-900 transition-colors hover:bg-ctx-subtle disabled:opacity-50"
      >
        {copied ? (
          <>
            <IconCheckCircle className="h-4 w-4 text-green-500" />
            Link copied — share it with your firm
          </>
        ) : (
          <>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
              <path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z" />
            </svg>
            {generating ? "Generating link…" : "Copy invite link"}
          </>
        )}
      </button>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <p className="onboarding-invite-note text-center text-xs text-ctx-muted">
        Anyone with the link can join your workspace for the next 7 days. You
        can always invite people later from the sidebar.
      </p>
    </div>
  );
}
