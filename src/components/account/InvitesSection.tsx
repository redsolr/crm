"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invitesApi, type SeatInvite } from "@/lib/invitesApi";
import { queryKeys } from "@/queries/query-keys";

/**
 * Account → Team: the admin face of the owned invite flow. Create an
 * invite for an email, copy its link (v1 is link-first — no email
 * automation yet, the admin shares the URL themselves), revoke pending
 * ones, and see who accepted.
 */

const STATUS_STYLES: Record<SeatInvite["status"], string> = {
  pending:
    "bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-secondary)]",
  accepted: "bg-[var(--crm-green-subtle)] text-[var(--crm-green)]",
  revoked: "bg-[var(--crm-red-subtle)] text-[var(--crm-red)]",
  expired: "bg-[var(--crm-red-subtle)] text-[var(--crm-red)]",
};

export function InvitesSection() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const invites = useQuery({
    queryKey: queryKeys.invites.all,
    queryFn: () => invitesApi.listInvites(),
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.invites.all });

  const create = useMutation({
    mutationFn: (value: string) => invitesApi.createInvite(value),
    onSuccess: () => {
      setEmail("");
      setFormError(null);
      void invalidate();
    },
    onError: (err) => {
      console.error("[invites] create failed:", err);
      setFormError(
        err instanceof Error ? err.message : "Could not create the invite.",
      );
    },
  });

  const revoke = useMutation({
    mutationFn: (id: string) => invitesApi.revokeInvite(id),
    onSuccess: () => void invalidate(),
    onError: (err) => console.error("[invites] revoke failed:", err),
  });

  async function copyLink(invite: SeatInvite) {
    const url = `${window.location.origin}${invite.invite_path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId((c) => (c === invite.id ? null : c)), 1600);
    } catch (err) {
      console.error("[invites] clipboard write failed:", err);
      // Clipboard can be unavailable (permissions, http) — show the URL
      // so the admin can copy it manually.
      window.prompt("Copy the invite link:", url);
    }
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = email.trim().toLowerCase();
    if (value === "" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setFormError("Enter a valid email address.");
      return;
    }
    create.mutate(value);
  }

  const rows = invites.data ?? [];

  return (
    <section className="crm-panel space-y-3" data-testid="account-invites">
      <h2 className="crm-panel-title">Team</h2>
      <p className="text-[13px] text-[var(--theme-text-muted)]">
        Invite a teammate by email, then share the link with them — it
        opens a branded join page and their seat activates on accept.
      </p>

      <form
        onSubmit={handleSubmit}
        className="invites-create flex gap-2"
        data-testid="invites-create-form"
      >
        <input
          type="text"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setFormError(null);
          }}
          placeholder="teammate@company.com"
          className="min-w-0 flex-1 rounded-lg border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-tertiary)] px-3 py-2 text-sm text-[var(--theme-text-primary)] placeholder:text-[var(--theme-text-muted)] focus:outline-none focus:border-[var(--theme-text-muted)]"
          data-testid="invites-email-input"
        />
        <button
          type="submit"
          disabled={create.isPending}
          className="crm-btn-ghost shrink-0 disabled:opacity-50"
          data-testid="invites-create-button"
        >
          {create.isPending ? "Inviting…" : "Invite"}
        </button>
      </form>
      {formError !== null && (
        <p
          className="text-[12.5px] text-[var(--crm-red)]"
          data-testid="invites-error"
        >
          {formError}
        </p>
      )}

      {invites.isLoading ? (
        <p className="text-[13px] text-[var(--theme-text-muted)]">
          Loading invites…
        </p>
      ) : invites.isError ? (
        <p
          className="text-[12.5px] text-[var(--crm-red)]"
          data-testid="invites-load-error"
        >
          Could not load invites — reload to retry.
        </p>
      ) : rows.length === 0 ? (
        <p
          className="text-[13px] text-[var(--theme-text-muted)]"
          data-testid="invites-empty"
        >
          No invites yet.
        </p>
      ) : (
        <div className="space-y-2" data-testid="invites-list">
          {rows.map((invite) => (
            <div
              key={invite.id}
              className="crm-row-card crm-row-card-inset"
              data-testid="invites-row"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--theme-text-primary)]">
                {invite.email}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_STYLES[invite.status]}`}
                data-testid="invites-row-status"
              >
                {invite.status}
              </span>
              {invite.status === "pending" && (
                <>
                  <button
                    type="button"
                    onClick={() => void copyLink(invite)}
                    className="crm-btn-ghost crm-btn-xs"
                    data-testid="invites-row-copy"
                  >
                    {copiedId === invite.id ? "Copied!" : "Copy link"}
                  </button>
                  <button
                    type="button"
                    onClick={() => revoke.mutate(invite.id)}
                    disabled={revoke.isPending}
                    className="crm-btn-ghost crm-btn-xs text-[var(--crm-red)] disabled:opacity-50"
                    data-testid="invites-row-revoke"
                  >
                    Revoke
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
