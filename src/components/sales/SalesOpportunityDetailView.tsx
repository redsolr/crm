"use client";

/**
 * Opportunity detail view.
 *
 * Renders the opportunity attribute editor (per the type's
 * AttributeDefinitions), a stage dropdown for pipeline transitions
 * (PATCH carries the `If-Match` header automatically via
 * `workItemsApi.updateWorkItem`), and two embedded child lists —
 * call_notes and commitments. Lost-reason flow polish lands in
 * Phase 2B; for now we surface lost_reason / not_now_until as
 * regular attribute fields.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useSalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";
import {
  useAttributeValuesQuery,
  useChildItemsQuery,
  useWorkItemQuery,
} from "@/lib/sales/use-sales-queries";
import { useTransitionWorkItem } from "@/lib/sales/use-sales-mutations";
import {
  COMMITMENT_STATE_KEYS,
  PIPELINE_STAGE_ORDER,
  SALES_TYPE_KEYS,
} from "@/lib/sales/constants";
import { fireActivation } from "@/lib/sales/activation";
import {
  useEntityActivitiesQuery,
  useRecordTimeline,
} from "@/lib/sales/use-record-timeline";
import type { AttributeDefinition } from "@/lib/generated/api/models";
import type { WorkItem } from "@/lib/workItemsApi";
import { queryKeys } from "@/queries/query-keys";
import { CreateCallNoteModal } from "./CreateCallNoteModal";
import { CreateCommitmentModal } from "./CreateCommitmentModal";
import { TransitionToClosedModal } from "./TransitionToClosedModal";
import { InterviewMode } from "./interview/InterviewMode";
import { BRAND_CTA_CLASS } from "./form";
import { SalesActivityTimeline } from "./SalesActivityTimeline";
import { AttributeEditorPanel } from "./AttributeFieldEditor";

interface Props {
  opportunityId: string;
}

export function SalesOpportunityDetailView({ opportunityId }: Props) {
  const router = useRouter();
  const { bundle, isLoading: bundleLoading } = useSalesWorkspaceBundle();
  const opportunity = useWorkItemQuery(opportunityId);
  const attributeValues = useAttributeValuesQuery(opportunityId);
  const children = useChildItemsQuery(
    bundle?.workspace.id,
    opportunityId,
  );
  const transition = useTransitionWorkItem();

  // Timeline inputs (hooks must precede the conditional returns).
  const activities = useEntityActivitiesQuery(opportunityId);
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
    children.data?.data ?? [],
    childTimelineDefs,
  );

  const [showCallModal, setShowCallModal] = useState(false);
  const [showCommitmentModal, setShowCommitmentModal] = useState(false);
  const [showInterview, setShowInterview] = useState(false);
  const [closedTransition, setClosedTransition] = useState<
    "lost" | "not_now" | null
  >(null);

  if (bundleLoading || opportunity.isLoading) {
    return (
      <div className="sales-opportunity-detail flex-1 min-w-0 flex items-center justify-center">
        <span className="text-sm text-[var(--theme-text-muted)]">Loading opportunity…</span>
      </div>
    );
  }

  if (!bundle || !opportunity.data) {
    return (
      <div className="sales-opportunity-detail flex-1 min-w-0 flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-[var(--theme-text-secondary)] mb-3">
            This opportunity isn&apos;t available.
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

  const opp = opportunity.data;
  const opportunityType = bundle.workItemTypes.find(
    (t) => t.key === SALES_TYPE_KEYS.opportunity,
  );
  const opportunityDefs = opportunityType
    ? bundle.attributeDefinitionsByType[opportunityType.id] ?? []
    : [];
  const callNoteChildren = children.data?.data.filter(
    (w) => w.type.key === SALES_TYPE_KEYS.call_note,
  ) ?? [];
  const commitmentChildren = children.data?.data.filter(
    (w) => w.type.key === SALES_TYPE_KEYS.commitment,
  ) ?? [];

  return (
    <div
      className="sales-opportunity-detail flex-1 min-w-0 overflow-y-auto"
      data-testid="sales-opportunity-detail"
    >
      <div className="crm-view-header">
        <button
          onClick={() => router.push("/sales")}
          className="text-[13px] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] transition-colors"
          data-testid="sales-opportunity-back"
        >
          ← Pipeline
        </button>
        <span className="text-[var(--theme-text-muted)]">/</span>
        <h1
          className="crm-view-title flex-1 truncate"
          data-testid="sales-opportunity-title"
        >
          {opp.title}
        </h1>
        <button
          onClick={() => setShowInterview(true)}
          className={`px-3 py-1.5 rounded-md text-[12.5px] font-medium ${BRAND_CTA_CLASS}`}
          data-testid="interview-start-button"
          title="Tap-through discovery interview — saves as a call note"
        >
          ▶ Interview
        </button>
        <select
          value={opp.state.key}
          onChange={(e) => {
            const next = e.target.value;
            // Intercept closures — `lost` requires lost_reason, `not_now`
            // requires not_now_until. The modal handles the attribute
            // write before the workflow transition. Other transitions
            // PATCH directly.
            if (next === "lost" || next === "not_now") {
              setClosedTransition(next);
              return;
            }
            transition.mutate({
              id: opp.id,
              version: opp.version,
              state_key: next,
            });
          }}
          className="px-3 py-1.5 rounded-md text-[12.5px] bg-[var(--theme-bg-tertiary)] border border-[var(--theme-border-secondary)] text-[var(--theme-text-primary)] focus:outline-none focus:border-[var(--theme-accent-border)]"
          data-testid="sales-opportunity-detail-stage-select"
          aria-label="Pipeline stage"
        >
          {PIPELINE_STAGE_ORDER.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="px-5 py-5 grid grid-cols-1 lg:grid-cols-3 gap-5">
        <AttributeEditorPanel
          workItemId={opp.id}
          definitions={opportunityDefs}
          values={attributeValues.data?.data ?? []}
          title="Attributes"
          testid="sales-attribute-editor"
        />

        <section
          className="sales-opportunity-timeline crm-panel"
          data-testid="sales-opportunity-timeline"
        >
          <h2 className="crm-panel-title mb-3">Activity</h2>
          <SalesActivityTimeline
            entries={timeline}
            emptyMessage="No touches yet — log the first call."
          />
        </section>

        <div className="space-y-4">
          <ChildSection
            title="Call notes"
            testid="sales-call-notes-section"
            items={callNoteChildren}
            onAdd={() => setShowCallModal(true)}
            addLabel="+ Log call"
            addTestId="sales-add-call-note-button"
            emptyMessage="No calls yet."
          />
          <ChildSection
            title="Commitments"
            testid="sales-commitments-section"
            items={commitmentChildren}
            onAdd={() => setShowCommitmentModal(true)}
            addLabel="+ Record commitment"
            addTestId="sales-add-commitment-button"
            emptyMessage="No promises tracked."
            renderItemRight={(item) => (
              <CommitmentStateButton
                commitment={item}
                onCompleted={() =>
                  fireActivation("first_commitment_completed", {
                    commitment_id: item.id,
                  })
                }
              />
            )}
          />
        </div>
      </div>

      {showCallModal && (
        <CreateCallNoteModal
          bundle={bundle}
          parentId={opp.id}
          onClose={() => setShowCallModal(false)}
        />
      )}
      {showCommitmentModal && (
        <CreateCommitmentModal
          bundle={bundle}
          parentId={opp.id}
          onClose={() => setShowCommitmentModal(false)}
        />
      )}
      {showInterview && (
        <InterviewMode
          bundle={bundle}
          opportunity={opp}
          onClose={() => setShowInterview(false)}
        />
      )}
      {closedTransition && (
        <TransitionToClosedModal
          opportunityId={opp.id}
          opportunityVersion={opp.version}
          nextStateKey={closedTransition}
          definitions={opportunityDefs}
          onClose={() => setClosedTransition(null)}
        />
      )}
    </div>
  );
}

// Attribute editing lives in the shared `AttributeEditorPanel`
// (`AttributeFieldEditor.tsx`) — one controlled editor for both record
// pages since the 2026-07-18 SOLID/DRY pass.

// ── Child section ───────────────────────────────────────────────────────────

function ChildSection({
  title,
  testid,
  items,
  onAdd,
  addLabel,
  addTestId,
  emptyMessage,
  renderItemRight,
}: {
  title: string;
  testid: string;
  items: WorkItem[];
  onAdd: () => void;
  addLabel: string;
  addTestId: string;
  emptyMessage: string;
  renderItemRight?: (item: WorkItem) => React.ReactNode;
}) {
  return (
    <section className="sales-child-section crm-panel" data-testid={testid}>
      <div className="flex items-center gap-2 mb-3">
        <h2 className="crm-panel-title">{title}</h2>
        <div className="flex-1" />
        <button
          onClick={onAdd}
          data-testid={addTestId}
          className="crm-btn-ghost crm-btn-xs"
        >
          {addLabel}
        </button>
      </div>
      {items.length === 0 ? (
        <p
          className="text-sm text-[var(--theme-text-muted)] italic"
          data-testid={`${testid}-empty`}
        >
          {emptyMessage}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="crm-row-card crm-row-card-inset"
              data-testid={`${testid}-item`}
              data-item-id={item.id}
            >
              <span className="flex-1 min-w-0 text-[13px] text-[var(--theme-text-primary)] truncate">
                {item.title}
              </span>
              <span className="text-xs text-[var(--theme-text-muted)]">
                {item.state.key.replace(/_/g, " ")}
              </span>
              {renderItemRight?.(item)}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function CommitmentStateButton({
  commitment,
  onCompleted,
}: {
  commitment: WorkItem;
  onCompleted: () => void;
}) {
  const queryClient = useQueryClient();
  const transition = useTransitionWorkItem();
  const isDone = commitment.state.key === COMMITMENT_STATE_KEYS.done;

  return (
    <button
      data-testid="sales-commitment-toggle"
      onClick={() => {
        const nextKey = isDone
          ? COMMITMENT_STATE_KEYS.open
          : COMMITMENT_STATE_KEYS.done;
        transition.mutate(
          {
            id: commitment.id,
            version: commitment.version,
            state_key: nextKey,
          },
          {
            onSuccess: () => {
              if (nextKey === COMMITMENT_STATE_KEYS.done) onCompleted();
              void queryClient.invalidateQueries({
                queryKey: queryKeys.workItems.all,
              });
            },
          },
        );
      }}
      className={isDone ? "crm-chip-done" : "crm-btn-ghost crm-btn-xs"}
    >
      {isDone ? "Done" : "Mark done"}
    </button>
  );
}
