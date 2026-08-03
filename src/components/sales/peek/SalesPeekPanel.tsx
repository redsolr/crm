"use client";

/**
 * Right-snap peek panel — crm-web's take on web-app's
 * TaskDetailMiniPanel (2026-07-14).
 *
 * Clicking a Companies row or a pipeline card opens THIS instead of
 * navigating: a compact drawer over the right edge of `.crm-main`
 * showing the record's details, so browsing the table never costs a
 * back-navigation. The expand button (and footer CTA) promotes to the
 * full detail route.
 *
 * Same interaction contract as web-app's mini panel: portals into the
 * content column (spans its full height, sidebar stays clickable),
 * dismisses on clicks in the content area outside the panel and on
 * Escape, quick-edits without leaving (stage transitions here, with
 * the same lost/not_now reason-capture interception as the detail
 * view).
 */

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import type { WorkItem } from "@/lib/workItemsApi";
import type { SalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";
import {
  useAttributeValuesQuery,
  useChildItemsQuery,
  useWorkItemQuery,
} from "@/lib/sales/use-sales-queries";
import { useTransitionWorkItem } from "@/lib/sales/use-sales-mutations";
import {
  PIPELINE_STAGE_ORDER,
  SALES_TYPE_KEYS,
} from "@/lib/sales/constants";
import { timeAgo } from "@/lib/sales/relative-time";
import { formatTHB } from "@/lib/format-currency";
import { TransitionToClosedModal } from "../TransitionToClosedModal";
import type {
  AttributeDefinition,
  AttributeValue,
} from "@/lib/generated/api/models";

/** CrmShell's content column — portal target + dismiss region. */
const MAIN_AREA_SELECTOR = ".crm-main";

const ExpandIcon = ({ size = 15 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Maximize — diagonal arrows to the corners (web-app parity). */}
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

const CloseIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

interface Props {
  bundle: SalesWorkspaceBundle;
  workItemId: string;
  onClose: () => void;
}

export function SalesPeekPanel({ bundle, workItemId, onClose }: Props) {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);

  const item = useWorkItemQuery(workItemId);
  const values = useAttributeValuesQuery(workItemId);
  const children = useChildItemsQuery(bundle.workspace.id, workItemId);
  const record = item.data;

  const typeKey = record?.type.key;
  const isOpportunity = typeKey === SALES_TYPE_KEYS.opportunity;
  // No href until the record resolves: the route branches on the
  // record TYPE, so expanding before the query lands would send an
  // opportunity to the account page (real race — a fast click after
  // opening the peek used to do exactly that).
  const href =
    record === undefined
      ? null
      : isOpportunity
        ? `/sales/opportunity/${workItemId}`
        : `/sales/account/${workItemId}`;

  // Company name for an opportunity — the parent account.
  const parent = useWorkItemQuery(
    isOpportunity ? (record?.parent_id ?? undefined) : undefined,
  );

  // Portal target resolved lazily on first client render — the content
  // column is an ancestor already in the DOM when a row click opens us.
  const [portalTarget] = useState<HTMLElement | null>(() =>
    typeof document === "undefined"
      ? null
      : document.querySelector<HTMLElement>(MAIN_AREA_SELECTOR),
  );

  // Dismiss on clicks in the content area outside the panel (the CRM
  // sidebar is a sibling — clicking it keeps the peek open), and on
  // Escape. The closed-transition modal portals OUTSIDE the panel, so
  // suppress dismissal while it's up.
  const [closedTransition, setClosedTransition] = useState<
    "lost" | "not_now" | null
  >(null);
  const closedTransitionOpen = closedTransition !== null;
  useEffect(() => {
    if (closedTransitionOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      const panel = panelRef.current;
      if (!panel || panel.contains(e.target as Node)) return;
      const main = panel.closest(MAIN_AREA_SELECTOR);
      if (main && main.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, closedTransitionOpen]);

  const transition = useTransitionWorkItem();

  // Attribute defs for this record's type, keyed for display.
  const defs = useMemo<AttributeDefinition[]>(() => {
    const type = bundle.workItemTypes.find((t) => t.key === typeKey);
    return type ? (bundle.attributeDefinitionsByType[type.id] ?? []) : [];
  }, [bundle, typeKey]);

  const valueByDefId = useMemo(() => {
    const map: Record<string, AttributeValue> = {};
    for (const v of values.data?.data ?? []) map[v.definition_id] = v;
    return map;
  }, [values.data]);

  const childItems = children.data?.data ?? [];
  const callNotes = childItems.filter(
    (w) => w.type.key === SALES_TYPE_KEYS.call_note,
  );
  const commitments = childItems.filter(
    (w) => w.type.key === SALES_TYPE_KEYS.commitment,
  );
  const childOpportunities = childItems.filter(
    (w) => w.type.key === SALES_TYPE_KEYS.opportunity,
  );

  const handleExpand = () => {
    if (href === null) return;
    onClose();
    router.push(href);
  };

  if (!portalTarget) return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Record details"
      className="sales-peek-panel absolute right-0 top-0 bottom-0 z-30 w-full md:w-[37%] md:min-w-[380px] md:max-w-[560px] flex flex-col bg-[var(--theme-bg-secondary)] border-l border-[var(--theme-border-secondary)] shadow-[-12px_0_32px_rgba(0,0,0,0.4)]"
      data-testid="sales-peek-panel"
    >
      {/* ── Header ── */}
      <div className="sales-peek-header flex items-center gap-1 px-3 h-12 border-b border-[var(--theme-border-primary)] flex-shrink-0">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--theme-text-muted)]">
          {isOpportunity ? "Opportunity" : "Company"}
        </span>
        {record && (
          <span className="text-[12px] text-[var(--theme-text-muted)] font-mono ml-1">
            {record.identifier}
          </span>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={handleExpand}
          disabled={href === null}
          title="Open full view"
          data-testid="sales-peek-expand"
          className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-hover)] rounded-md transition-colors disabled:opacity-40"
        >
          <ExpandIcon />
        </button>
        <div className="w-px h-4 bg-[var(--theme-border-secondary)] mx-0.5" />
        <button
          type="button"
          onClick={onClose}
          title="Close"
          data-testid="sales-peek-close"
          className="p-1.5 text-[var(--theme-text-muted)] hover:text-[var(--theme-text-primary)] hover:bg-[var(--theme-bg-hover)] rounded-md transition-colors"
        >
          <CloseIcon />
        </button>
      </div>

      {/* ── Body ── */}
      <div className="sales-peek-body flex-1 overflow-y-auto px-5 py-4">
        {!record ? (
          <p className="text-[13px] text-[var(--theme-text-muted)]">
            Loading…
          </p>
        ) : (
          <>
            <h2
              className="text-[16px] font-semibold leading-snug text-[var(--theme-text-primary)] mb-4"
              data-testid="sales-peek-title"
            >
              {record.title}
            </h2>

            {/* Quick properties */}
            <div className="sales-peek-properties space-y-2.5 p-3.5 rounded-xl bg-[var(--theme-bg-tertiary)] border border-[var(--theme-border-primary)]">
              {isOpportunity ? (
                <>
                  <PeekRow label="Stage">
                    <select
                      value={record.state.key}
                      onChange={(e) => {
                        const next = e.target.value;
                        if (next === "lost" || next === "not_now") {
                          setClosedTransition(next);
                          return;
                        }
                        transition.mutate({
                          id: record.id,
                          version: record.version,
                          state_key: next,
                        });
                      }}
                      className="rounded-md bg-[var(--theme-bg-secondary)] border border-[var(--theme-border-secondary)] px-2 py-1 text-[12.5px] text-[var(--theme-text-primary)] focus:outline-none"
                      data-testid="sales-peek-stage-select"
                      aria-label="Pipeline stage"
                    >
                      {PIPELINE_STAGE_ORDER.map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </PeekRow>
                  <PeekRow label="Company">
                    <span className="text-[13px] text-[var(--theme-text-primary)]">
                      {parent.data?.title ?? "—"}
                    </span>
                  </PeekRow>
                </>
              ) : (
                <PeekRow label="Status">
                  <span className="crm-tag">
                    {record.state.name || record.state.key}
                  </span>
                </PeekRow>
              )}
              {defs
                .slice()
                .sort((a, b) => a.position - b.position)
                .map((def) => (
                  <PeekRow key={def.id} label={def.name}>
                    <span className="text-[13px] text-[var(--theme-text-primary)] break-words">
                      {formatAttributeValue(def, valueByDefId[def.id]?.value)}
                    </span>
                  </PeekRow>
                ))}
            </div>

            {/* Related records */}
            {isOpportunity ? (
              <>
                <PeekSection
                  title={`Call notes (${callNotes.length})`}
                  emptyMessage="No calls yet."
                  items={callNotes}
                />
                <PeekSection
                  title={`Commitments (${commitments.length})`}
                  emptyMessage="No promises tracked."
                  items={commitments}
                  renderRight={(w) => (
                    <span className="crm-tag">{w.state.key}</span>
                  )}
                />
              </>
            ) : (
              <PeekSection
                title={`Opportunities (${childOpportunities.length})`}
                emptyMessage="No opportunities yet."
                items={childOpportunities}
                onOpenItem={(w) => {
                  onClose();
                  router.push(`/sales/opportunity/${w.id}`);
                }}
                renderRight={(w) => (
                  <span className="crm-tag">
                    {w.state.key.replace(/_/g, " ")}
                  </span>
                )}
              />
            )}

            {/* Description */}
            {record.description && (
              <div className="mt-5">
                <h3 className="crm-panel-title mb-2">Notes</h3>
                <p className="text-[13px] text-[var(--theme-text-secondary)] whitespace-pre-wrap line-clamp-[10] leading-relaxed">
                  {record.description}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Footer — promote to the full view ── */}
      <div className="sales-peek-footer flex-shrink-0 border-t border-[var(--theme-border-primary)] px-4 py-3">
        <button
          type="button"
          onClick={handleExpand}
          disabled={href === null}
          className="flex items-center justify-center gap-2 w-full py-2 text-[13px] font-medium text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)] bg-[var(--theme-bg-tertiary)] hover:bg-[var(--theme-bg-hover)] border border-[var(--theme-border-primary)] rounded-lg transition-colors disabled:opacity-40"
        >
          <ExpandIcon size={14} />
          Open full view
        </button>
      </div>

      {closedTransition && record && (
        <TransitionToClosedModal
          opportunityId={record.id}
          opportunityVersion={record.version}
          nextStateKey={closedTransition}
          definitions={defs}
          onClose={() => setClosedTransition(null)}
        />
      )}
    </div>,
    portalTarget,
  );
}

function PeekRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 min-h-[24px]">
      <span className="w-28 flex-shrink-0 text-[12px] font-medium text-[var(--theme-text-muted)]">
        {label}
      </span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function PeekSection({
  title,
  emptyMessage,
  items,
  onOpenItem,
  renderRight,
}: {
  title: string;
  emptyMessage: string;
  items: WorkItem[];
  onOpenItem?: (item: WorkItem) => void;
  renderRight?: (item: WorkItem) => React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <h3 className="crm-panel-title mb-2">{title}</h3>
      {items.length === 0 ? (
        <p className="text-[12.5px] text-[var(--theme-text-muted)]">
          {emptyMessage}
        </p>
      ) : (
        <div className="space-y-1.5">
          {items.slice(0, 6).map((w) => {
            const row = (
              <>
                <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--theme-text-primary)]">
                  {w.title}
                </span>
                {renderRight?.(w)}
                <span className="shrink-0 text-[11.5px] text-[var(--theme-text-muted)]">
                  {timeAgo(w.updated_at)}
                </span>
              </>
            );
            return onOpenItem ? (
              <button
                key={w.id}
                type="button"
                onClick={() => onOpenItem(w)}
                className="crm-row-card crm-row-card-inset w-full text-left"
              >
                {row}
              </button>
            ) : (
              <div key={w.id} className="crm-row-card crm-row-card-inset">
                {row}
              </div>
            );
          })}
          {items.length > 6 && (
            <p className="text-[11.5px] text-[var(--theme-text-muted)] pl-1">
              +{items.length - 6} more in the full view
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Human display for an attribute value; select-ish snake_case values
 *  read as words, money-ish keys get ฿ formatting. */
function formatAttributeValue(
  def: AttributeDefinition,
  raw: unknown,
): string {
  if (raw === undefined || raw === null || raw === "") return "—";
  if (typeof raw === "number") {
    return def.key.includes("value") || def.key.includes("estimate")
      ? formatTHB(raw)
      : raw.toLocaleString();
  }
  if (typeof raw === "string") {
    if (def.data_type === "select") return raw.replace(/_/g, " ");
    return raw;
  }
  return JSON.stringify(raw);
}
