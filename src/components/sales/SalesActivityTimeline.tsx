"use client";

import { timeAgo } from "@/lib/sales/relative-time";
import type { TimelineEntry } from "@/lib/sales/use-record-timeline";

/**
 * Reverse-chron activity timeline for a record page — the merged feed of
 * platform activity (stage moves, edits), call notes, and commitments.
 * Attio record-page center column, dense and decluttered. Styled with
 * utilities (semantic class names kept for tests/readability).
 */
export function SalesActivityTimeline({
  entries,
  emptyMessage = "No activity yet.",
}: {
  entries: TimelineEntry[];
  emptyMessage?: string;
}) {
  if (entries.length === 0) {
    return (
      <p
        className="text-sm text-[var(--theme-text-muted)] italic"
        data-testid="sales-timeline-empty"
      >
        {emptyMessage}
      </p>
    );
  }

  return (
    <ol
      className="sales-activity-timeline relative space-y-3 pl-4 before:absolute before:left-[3px] before:top-1 before:bottom-1 before:w-px before:bg-[var(--theme-border-primary)]"
      data-testid="sales-timeline"
    >
      {entries.map((entry) => (
        <li
          key={`${entry.kind}-${entry.id}`}
          className="sales-timeline-entry relative"
          data-testid={`sales-timeline-${entry.kind}`}
        >
          <span
            className={`sales-timeline-dot absolute -left-[15.5px] top-[5px] h-2 w-2 rounded-full border ${
              entry.kind === "call_note"
                ? "bg-[var(--theme-accent)] border-[var(--theme-accent)]"
                : entry.kind === "commitment"
                  ? "bg-[var(--crm-amber,#F59E0B)] border-[var(--crm-amber,#F59E0B)]"
                  : "bg-[var(--theme-bg-tertiary)] border-[var(--theme-border-hover)]"
            }`}
            aria-hidden="true"
          />
          <div className="sales-timeline-body min-w-0">
            {entry.kind === "activity" && (
              <p className="sales-timeline-line text-[13px] leading-5">
                {entry.author && (
                  <span
                    className="sales-timeline-author font-medium text-[var(--theme-text-primary)] mr-1"
                    data-testid="sales-timeline-author"
                  >
                    {entry.author}
                  </span>
                )}
                <span className="text-[var(--theme-text-secondary)]">
                  {entry.label}
                </span>
                {entry.detail && (
                  <span className="crm-tag ml-2">{entry.detail}</span>
                )}
              </p>
            )}
            {entry.kind === "call_note" && (
              <>
                <p className="sales-timeline-line text-[13px] leading-5 min-w-0">
                  <span className="font-medium text-[var(--theme-text-primary)]">
                    {entry.item.title}
                  </span>
                  {entry.callType && (
                    <span className="crm-tag ml-2">
                      {entry.callType.replace(/_/g, " ")}
                    </span>
                  )}
                  {entry.outcome && (
                    <span
                      className={`ml-2 ${
                        entry.outcome === "positive"
                          ? "crm-badge-success"
                          : entry.outcome === "negative"
                            ? "crm-badge-danger"
                            : "crm-tag"
                      }`}
                    >
                      {entry.outcome.replace(/_/g, " ")}
                    </span>
                  )}
                </p>
                {entry.summary && (
                  <p className="sales-timeline-summary mt-1 text-xs leading-5 text-[var(--theme-text-secondary)] whitespace-pre-wrap line-clamp-4">
                    {entry.summary}
                  </p>
                )}
              </>
            )}
            {entry.kind === "commitment" && (
              <p className="sales-timeline-line text-[13px] leading-5">
                <span
                  className={
                    entry.done
                      ? "line-through text-[var(--theme-text-muted)]"
                      : "text-[var(--theme-text-primary)]"
                  }
                >
                  {entry.item.title}
                </span>
                {entry.promisedTo && (
                  <span className="text-xs text-[var(--theme-text-muted)] ml-2">
                    → {entry.promisedTo}
                  </span>
                )}
                {entry.dueDate && (
                  <span className="crm-tag ml-2">due {entry.dueDate}</span>
                )}
                {entry.done && <span className="crm-chip-done ml-2">Done</span>}
              </p>
            )}
            <span className="sales-timeline-when block mt-0.5 text-[11px] text-[var(--theme-text-muted)]">
              {timeAgo(entry.at)}
              {entry.kind !== "activity" && entry.author && (
                <span data-testid="sales-timeline-author"> · {entry.author}</span>
              )}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}
