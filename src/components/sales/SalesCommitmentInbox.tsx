"use client";

/**
 * Sales commitment inbox.
 *
 * Org-wide list of every open commitment across every opportunity,
 * grouped by overdue / due today / upcoming / done. The founder
 * dogfood loop says "no promise gets dropped" — this is the view
 * that enforces it. Sibling to the pipeline grouping inside the
 * Sales tab.
 */

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useCommitmentsInbox, type InboxCommitmentRow } from "@/lib/sales/use-commitments-inbox";
import {
  COMMITMENT_STATE_KEYS,
  SALES_TYPE_KEYS,
} from "@/lib/sales/constants";
import { useTransitionWorkItem } from "@/lib/sales/use-sales-mutations";
import { fireActivation } from "@/lib/sales/activation";
import type { SalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";
import { queryKeys } from "@/queries/query-keys";

interface Props {
  bundle: SalesWorkspaceBundle;
}

export function SalesCommitmentInbox({ bundle }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const transition = useTransitionWorkItem();

  const commitmentType = bundle.workItemTypes.find(
    (t) => t.key === SALES_TYPE_KEYS.commitment,
  );
  const definitions = commitmentType
    ? bundle.attributeDefinitionsByType[commitmentType.id] ?? []
    : [];

  const { buckets, isLoading } = useCommitmentsInbox(
    bundle.workspace.id,
    definitions,
  );

  const handleToggleDone = (row: InboxCommitmentRow) => {
    const isDone = row.commitment.state.key === COMMITMENT_STATE_KEYS.done;
    const nextKey = isDone
      ? COMMITMENT_STATE_KEYS.open
      : COMMITMENT_STATE_KEYS.done;
    transition.mutate(
      {
        id: row.commitment.id,
        version: row.commitment.version,
        state_key: nextKey,
      },
      {
        onSuccess: () => {
          if (nextKey === COMMITMENT_STATE_KEYS.done) {
            fireActivation("first_commitment_completed", {
              commitment_id: row.commitment.id,
            });
          }
          void queryClient.invalidateQueries({
            queryKey: queryKeys.workItems.all,
          });
        },
      },
    );
  };

  if (isLoading) {
    return (
      <div
        className="sales-inbox-loading crm-view-skeleton-body"
        data-testid="sales-inbox-loading"
        aria-busy="true"
        aria-label="Loading commitments"
      >
        {Array.from({ length: 5 }, (_, r) => (
          <div key={r} className="crm-view-skeleton-row">
            <span
              className="crm-skeleton-bar"
              style={{ width: `${[64, 48, 72, 40, 56][r]}%` }}
            />
            <span
              className="crm-skeleton-bar"
              style={{ width: `${[30, 22, 34, 18, 26][r]}%` }}
            />
          </div>
        ))}
      </div>
    );
  }

  const totalOpen =
    buckets.overdue.length + buckets.due_today.length + buckets.upcoming.length;

  if (totalOpen === 0 && buckets.done_dropped.length === 0) {
    return (
      <div
        className="sales-inbox-empty py-12 text-center"
        data-testid="sales-inbox-empty"
      >
        <h3 className="text-base font-semibold text-[var(--claude-text)] mb-2">
          No commitments yet
        </h3>
        <p className="text-sm text-[var(--theme-text-muted)] max-w-md mx-auto">
          When you record a promise from an opportunity, it lands here —
          overdue ones surface first so nothing falls through the cracks.
        </p>
      </div>
    );
  }

  return (
    <div
      className="sales-inbox px-6 py-4 space-y-6"
      data-testid="sales-inbox"
    >
      <Bucket
        title="Overdue"
        rows={buckets.overdue}
        testid="sales-inbox-overdue"
        emphasis="danger"
        onOpenParent={(row) =>
          row.parent &&
          row.parent.type.key === SALES_TYPE_KEYS.opportunity &&
          router.push(`/sales/opportunity/${row.parent.id}`)
        }
        onToggleDone={handleToggleDone}
      />
      <Bucket
        title="Due today"
        rows={buckets.due_today}
        testid="sales-inbox-due-today"
        emphasis="warn"
        onOpenParent={(row) =>
          row.parent &&
          row.parent.type.key === SALES_TYPE_KEYS.opportunity &&
          router.push(`/sales/opportunity/${row.parent.id}`)
        }
        onToggleDone={handleToggleDone}
      />
      <Bucket
        title="Upcoming"
        rows={buckets.upcoming}
        testid="sales-inbox-upcoming"
        emphasis="default"
        onOpenParent={(row) =>
          row.parent &&
          row.parent.type.key === SALES_TYPE_KEYS.opportunity &&
          router.push(`/sales/opportunity/${row.parent.id}`)
        }
        onToggleDone={handleToggleDone}
      />
      {buckets.done_dropped.length > 0 && (
        <Bucket
          title="Done / dropped"
          rows={buckets.done_dropped}
          testid="sales-inbox-done"
          emphasis="muted"
          onOpenParent={(row) =>
            row.parent &&
            row.parent.type.key === SALES_TYPE_KEYS.opportunity &&
            router.push(`/sales/opportunity/${row.parent.id}`)
          }
          onToggleDone={handleToggleDone}
        />
      )}
    </div>
  );
}

function Bucket({
  title,
  rows,
  testid,
  emphasis,
  onOpenParent,
  onToggleDone,
}: {
  title: string;
  rows: InboxCommitmentRow[];
  testid: string;
  emphasis: "danger" | "warn" | "default" | "muted";
  onOpenParent: (row: InboxCommitmentRow) => void;
  onToggleDone: (row: InboxCommitmentRow) => void;
}) {
  if (rows.length === 0) return null;
  const headingColor =
    emphasis === "danger"
      ? "text-[var(--crm-red)]"
      : emphasis === "warn"
        ? "text-[var(--crm-amber)]"
        : emphasis === "muted"
          ? "text-[var(--theme-text-muted)]"
          : "text-[var(--theme-text-secondary)]";

  return (
    <section className="sales-inbox-bucket" data-testid={testid}>
      <h3
        className={`text-[11px] font-semibold uppercase tracking-wider mb-2 ${headingColor}`}
      >
        {title} · {rows.length}
      </h3>
      <ul className="space-y-1.5">
        {rows.map((row) => (
          <li
            key={row.commitment.id}
            className="crm-row-card"
            data-testid={`${testid}-item`}
            data-commitment-id={row.commitment.id}
          >
            <button
              type="button"
              onClick={() => onOpenParent(row)}
              className="flex-1 min-w-0 text-left"
            >
              <div className="text-[13px] font-medium text-[var(--theme-text-primary)] truncate">
                {row.commitment.title}
              </div>
              <div className="text-xs text-[var(--theme-text-muted)] truncate mt-0.5">
                {row.parent ? row.parent.title : "—"}
                {row.promisedTo ? ` · for ${row.promisedTo}` : ""}
                {row.dueDate ? ` · due ${row.dueDate}` : ""}
              </div>
            </button>
            <button
              type="button"
              data-testid="sales-inbox-toggle-done"
              onClick={() => onToggleDone(row)}
              className={
                row.commitment.state.key === COMMITMENT_STATE_KEYS.done
                  ? "crm-chip-done"
                  : "crm-btn-ghost crm-btn-xs"
              }
            >
              {row.commitment.state.key === COMMITMENT_STATE_KEYS.done
                ? "Done"
                : "Mark done"}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
