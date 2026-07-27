"use client";

/**
 * `usePageContext` — derives the Ask conversation's page-context
 * descriptor from the current pathname plus ALREADY-CACHED React Query
 * data. No new fetches: record routes read the work-item detail cache
 * (`queryKeys.workItems.detail(id)`) that the detail view's own
 * `useWorkItemQuery` populated; a cache miss falls back to the raw id.
 *
 * Two faces of the same context:
 *   - `label` — the full descriptor sent on the wire
 *     (`buildAskWireText` wraps it in `[Viewing: …]`).
 *   - `chip`  — the short form for the drawer header's context chip
 *     ("Context: Baker & Partners").
 *
 * `/sales/ask` (the full-page chat) and unmapped routes return null —
 * no chip, no preamble.
 */

import { usePathname } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/queries/query-keys";
import type { WorkItem } from "@/lib/workItemsApi";

export interface AskPageContext {
  /** Full descriptor for the wire preamble. */
  label: string;
  /** Short form for the header chip. */
  chip: string;
}

export function usePageContext(): AskPageContext | null {
  const pathname = usePathname();
  const queryClient = useQueryClient();

  if (pathname === "/sales") {
    return { label: "Pipeline view", chip: "Pipeline" };
  }
  if (pathname.startsWith("/sales/inbox")) {
    return { label: "Inbox (follow-ups + commitments)", chip: "Inbox" };
  }
  if (pathname.startsWith("/sales/companies")) {
    return { label: "Companies list", chip: "Companies" };
  }
  if (pathname.startsWith("/sales/contacts")) {
    return { label: "Contacts list", chip: "Contacts" };
  }
  if (pathname.startsWith("/sales/reports")) {
    return { label: "Reports", chip: "Reports" };
  }

  const accountId = matchRecordId(pathname, "/sales/account/");
  if (accountId !== null) {
    const record = queryClient.getQueryData<WorkItem>(
      queryKeys.workItems.detail(accountId),
    );
    if (!record) {
      return { label: `Company record: ${accountId}`, chip: accountId };
    }
    return {
      label: `Company record: ${record.title} (${record.identifier})`,
      chip: record.title,
    };
  }

  const opportunityId = matchRecordId(pathname, "/sales/opportunity/");
  if (opportunityId !== null) {
    const record = queryClient.getQueryData<WorkItem>(
      queryKeys.workItems.detail(opportunityId),
    );
    if (!record) {
      return { label: `Deal record: ${opportunityId}`, chip: opportunityId };
    }
    return {
      label: `Deal record: ${record.title} (${record.identifier}) — stage ${record.state.name}`,
      chip: record.title,
    };
  }

  // /sales/ask (the full page IS the conversation — no framing) and any
  // route outside the mapped CRM views (e.g. /account settings).
  return null;
}

/** Extract the record id from `<prefix><id>` paths; null when no match. */
function matchRecordId(pathname: string, prefix: string): string | null {
  if (!pathname.startsWith(prefix)) return null;
  const id = pathname.slice(prefix.length).split("/")[0] ?? "";
  return id === "" ? null : id;
}
