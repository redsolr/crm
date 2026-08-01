"use client";

/**
 * Account detail view — Attio record-page shape.
 *
 * "Everything about Acme in one place": three rails — the attribute
 * editor (source / company URL / segment / current tools / pain
 * summary), the merged activity TIMELINE (account activity + call
 * notes rolled up across this account's opportunities), and the
 * related-records rail (every opportunity ever run, active AND closed,
 * plus the people we talk to here).
 */

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";
import {
  useAttributeValuesQuery,
  useCallNotesQuery,
  useChildItemsQuery,
  useWorkItemQuery,
} from "@/lib/sales/use-sales-queries";
import { SALES_TYPE_KEYS } from "@/lib/sales/constants";
import {
  useEntityActivitiesQuery,
  useRecordTimeline,
} from "@/lib/sales/use-record-timeline";
import { domainFromUrl } from "@/lib/sales/company-domain";
import type { AttributeDefinition } from "@/lib/generated/api/models";
import type { WorkItem } from "@/lib/workItemsApi";
import { CompanyLogo } from "./CompanyLogo";
import { PersonAvatar } from "./PersonAvatar";
import { SalesActivityTimeline } from "./SalesActivityTimeline";
import { AttributeEditorPanel } from "./AttributeFieldEditor";
import { RecordPresenceLayer } from "@/components/presence/RecordPresenceLayer";
import { LiveNotePanel } from "./notes/LiveNotePanel";

interface Props {
  accountId: string;
}

export function SalesAccountDetailView({ accountId }: Props) {
  const router = useRouter();
  const { bundle, isLoading: bundleLoading } = useSalesWorkspaceBundle();
  const account = useWorkItemQuery(accountId);
  const accountAttributeValues = useAttributeValuesQuery(accountId);
  const childOpportunities = useChildItemsQuery(
    bundle?.workspace.id,
    accountId,
  );
  // Timeline inputs — account's own activity + workspace call notes
  // (filtered below to this account's opportunities).
  const activities = useEntityActivitiesQuery(accountId);
  const workspaceCallNotes = useCallNotesQuery(bundle?.workspace.id);

  const children = useMemo(
    () => childOpportunities.data?.data ?? [],
    [childOpportunities.data?.data],
  );
  const opportunityIds = useMemo(
    () =>
      new Set(
        children
          .filter((w) => w.type.key === SALES_TYPE_KEYS.opportunity)
          .map((w) => w.id),
      ),
    [children],
  );
  const rolledUpCallNotes = useMemo(
    () =>
      (workspaceCallNotes.data?.data ?? []).filter(
        (n) => n.parent_id !== null && opportunityIds.has(n.parent_id),
      ),
    [workspaceCallNotes.data?.data, opportunityIds],
  );
  const childTimelineDefs = useMemo(() => {
    if (!bundle) return [];
    const defs: AttributeDefinition[] = [];
    for (const key of [SALES_TYPE_KEYS.call_note, SALES_TYPE_KEYS.commitment]) {
      const type = bundle.workItemTypes.find((t) => t.key === key);
      if (type) defs.push(...(bundle.attributeDefinitionsByType[type.id] ?? []));
    }
    return defs;
  }, [bundle]);
  const timeline = useRecordTimeline(
    activities.data?.activities ?? [],
    rolledUpCallNotes,
    childTimelineDefs,
  );

  if (bundleLoading || account.isLoading) {
    return (
      <div className="sales-account-detail flex-1 min-w-0 flex items-center justify-center">
        <span className="text-sm text-[var(--theme-text-muted)]">Loading account…</span>
      </div>
    );
  }

  if (!bundle || !account.data) {
    return (
      <div className="sales-account-detail flex-1 min-w-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-[var(--theme-text-secondary)] mb-3">
            This account isn&apos;t available.
          </p>
          <button
            onClick={() => router.push("/sales")}
            className="text-sm text-[var(--theme-accent)] underline"
          >
            Back to pipeline
          </button>
        </div>
      </div>
    );
  }

  const accountType = bundle.workItemTypes.find(
    (t) => t.key === SALES_TYPE_KEYS.account,
  );
  const accountDefs = accountType
    ? bundle.attributeDefinitionsByType[accountType.id] ?? []
    : [];

  const opportunities = children.filter(
    (w) => w.type.key === SALES_TYPE_KEYS.opportunity,
  );
  const contacts = children.filter(
    (w) => w.type.key === SALES_TYPE_KEYS.contact,
  );

  // Logo domain from the already-fetched account attribute values.
  const urlDef = accountDefs.find((d) => d.key === "company_url");
  const companyUrlRaw = urlDef
    ? (accountAttributeValues.data?.data ?? []).find(
        (v) => v.definition_id === urlDef.id,
      )?.value
    : null;
  const logoDomain = domainFromUrl(
    typeof companyUrlRaw === "string" ? companyUrlRaw : null,
  );

  return (
    <div
      className="sales-account-detail relative flex-1 min-w-0 overflow-y-auto"
      data-testid="sales-account-detail"
    >
      <RecordPresenceLayer recordId={accountId} />
      <div className="crm-view-header">
        <button
          onClick={() => router.push("/sales")}
          className="text-[13px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] transition-colors"
          data-testid="sales-account-back"
        >
          ← Pipeline
        </button>
        <span className="text-[var(--theme-text-muted)]">/</span>
        <CompanyLogo
          name={account.data.title}
          domain={logoDomain}
          size={22}
        />
        <h1
          className="crm-view-title flex-1 truncate"
          data-testid="sales-account-title"
        >
          {account.data.title}
        </h1>
        <span className="crm-tag">Company</span>
      </div>

      <div className="px-5 py-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <AttributeEditorPanel
          workItemId={account.data.id}
          definitions={accountDefs}
          values={accountAttributeValues.data?.data ?? []}
          title="Company"
          testid="sales-account-attributes"
          fieldTestIdPrefix="sales-account-attr"
        />
        <section
          className="sales-account-timeline crm-panel"
          data-testid="sales-account-timeline"
        >
          <h2 className="crm-panel-title mb-3">Activity</h2>
          <SalesActivityTimeline
            entries={timeline}
            emptyMessage="No touches yet — log the first call."
          />
        </section>
        <div className="space-y-5 min-w-0">
          <LiveNotePanel
            bundle={bundle}
            recordId={accountId}
            recordTitle={account.data.title}
          />
          <OpportunitiesPanel
            opportunities={opportunities}
            onOpen={(id) => router.push(`/sales/opportunity/${id}`)}
          />
          <PeoplePanel
            contacts={contacts}
            onOpen={() => router.push("/sales/contacts")}
          />
        </div>
      </div>
    </div>
  );
}

// ── People panel ────────────────────────────────────────────────────────────

function PeoplePanel({
  contacts,
  onOpen,
}: {
  contacts: WorkItem[];
  onOpen: () => void;
}) {
  return (
    <section
      className="sales-account-people crm-panel space-y-3"
      data-testid="sales-account-people"
    >
      <h2 className="crm-panel-title">People · {contacts.length}</h2>
      {contacts.length === 0 ? (
        <p
          className="text-sm text-[var(--theme-text-muted)] italic"
          data-testid="sales-account-people-empty"
        >
          No contacts linked to this company yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {contacts.map((contact) => (
            <li
              key={contact.id}
              className="crm-row-card"
              data-testid="sales-account-person-item"
            >
              <PersonAvatar name={contact.title} size={18} />
              <button
                type="button"
                onClick={onOpen}
                className="flex-1 min-w-0 text-left text-[13px] text-[var(--theme-text-primary)] truncate"
              >
                {contact.title}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Attribute editing lives in the shared `AttributeEditorPanel`
// (`AttributeFieldEditor.tsx`) — one CONTROLLED editor for both record
// pages since the 2026-07-18 SOLID/DRY pass. That also retires the old
// uncontrolled fields' remount-on-updated_at workaround: external
// writes (✨ compute) now render through the controlled prop sync.

// ── Opportunities panel ─────────────────────────────────────────────────────

function OpportunitiesPanel({
  opportunities,
  onOpen,
}: {
  opportunities: WorkItem[];
  onOpen: (id: string) => void;
}) {
  return (
    <section
      className="sales-account-opportunities crm-panel space-y-3"
      data-testid="sales-account-opportunities"
    >
      <h2 className="crm-panel-title">
        Opportunities · {opportunities.length}
      </h2>
      {opportunities.length === 0 ? (
        <p
          className="text-sm text-[var(--theme-text-muted)] italic"
          data-testid="sales-account-opportunities-empty"
        >
          No opportunities yet against this account.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {opportunities.map((opp) => (
            <li
              key={opp.id}
              className="crm-row-card"
              data-testid="sales-account-opportunity-item"
            >
              <button
                type="button"
                onClick={() => onOpen(opp.id)}
                className="flex-1 min-w-0 text-left"
              >
                <div className="text-[13px] font-medium text-[var(--theme-text-primary)] truncate">
                  {opp.title}
                </div>
              </button>
              <span
                className={
                  opp.state.category === "done"
                    ? "crm-chip-done"
                    : opp.state.category === "dead"
                      ? "crm-chip-dead"
                      : "crm-tag"
                }
              >
                {opp.state.key.replace(/_/g, " ")}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
