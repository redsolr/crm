"use client";

/**
 * Morning-digest card (ambient-digest arc, 2026-08-07) — the top of
 * the Inbox tab. Renders the newest cron-composed digest: the
 * AI-drafted follow-ups (copy-and-send) plus the notification
 * enrollment toggle for THIS browser. The deterministic due/overdue
 * lists are NOT repeated here — they live directly below in the
 * Inbox's own sections; the card carries only what the cron adds
 * (drafts + push).
 *
 * Border is the neutral card border (founder 2026-08-08 — the blue
 * AI rail was dropped; the "Morning digest" label carries the AI
 * provenance on its own).
 */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { digestApi } from "@/lib/digestApi";
import { queryKeys } from "@/queries/query-keys";
import { usePushNotifications } from "@/hooks/use-push-notifications";

export function SalesDigestCard({
  onOpenOpportunity,
}: {
  onOpenOpportunity: (id: string) => void;
}) {
  const digestQuery = useQuery({
    queryKey: queryKeys.digest.latest(),
    queryFn: () => digestApi.getLatest(),
    staleTime: 5 * 60 * 1000,
  });
  const push = usePushNotifications();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const digest = digestQuery.data?.digest ?? null;
  // Nothing composed yet AND no push affordance → no empty chrome.
  if (digest === null && !push.available) return null;

  const copyDraft = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId((prev) => (prev === id ? null : prev)), 2000);
    } catch (error) {
      console.error("[digest] clipboard write failed:", error);
    }
  };

  return (
    <section className="crm-digest-card" data-testid="inbox-digest-card">
      <div className="crm-digest-header">
        <h2 className="crm-digest-heading">
          Morning digest
          {digest && (
            <span className="crm-digest-date" data-testid="digest-run-date">
              {digest.run_date}
            </span>
          )}
        </h2>
        {push.available && (
          <button
            type="button"
            className="crm-btn-ghost crm-btn-xs"
            data-testid="digest-push-toggle"
            disabled={push.busy}
            onClick={() => void (push.subscribed ? push.disable() : push.enable())}
          >
            {push.subscribed ? "Notifications on" : "Enable notifications"}
          </button>
        )}
      </div>

      {digest === null ? (
        <p className="crm-digest-empty" data-testid="digest-empty">
          No digest yet — the first one composes at 07:00 and lands here.
        </p>
      ) : (
        <>
          {digest.drafts.length > 0 && (
            <ul className="crm-digest-drafts space-y-1.5">
              {digest.drafts.map((d) => (
                <li
                  key={d.opportunity_id}
                  className="crm-row-card crm-digest-draft"
                  data-testid="digest-draft-row"
                >
                  <button
                    type="button"
                    className="flex-1 min-w-0 text-left"
                    onClick={() => onOpenOpportunity(d.opportunity_id)}
                  >
                    <span className="block text-[13px] font-medium text-[var(--theme-text-primary)] truncate">
                      {d.title}
                      {d.account_name ? ` · ${d.account_name}` : ""}
                    </span>
                    <span className="block text-xs text-[var(--theme-text-secondary)] mt-0.5 crm-digest-draft-text">
                      {d.draft}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="crm-btn-ghost crm-btn-xs"
                    data-testid="digest-draft-copy"
                    onClick={() => void copyDraft(d.opportunity_id, d.draft)}
                  >
                    {copiedId === d.opportunity_id ? "Copied" : "Copy"}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {digest.drafts.length === 0 && digest.drafts_error === null && (
            <p className="crm-digest-empty" data-testid="digest-no-drafts">
              Nothing actionable to draft this morning.
            </p>
          )}
          {digest.drafts_error !== null && (
            <p className="crm-digest-error" data-testid="digest-drafts-error">
              Drafting failed: {digest.drafts_error}
            </p>
          )}
        </>
      )}
    </section>
  );
}
