"use client";

/**
 * Work board card body — title + meta chips (project space, priority,
 * due date, Claude badge). Deliberately lighter than SalesCardBody:
 * tasks have no parent record or currency to surface.
 */

import type { WorkItem } from "@/lib/workItemsApi";
import {
  labelizeOptionKey,
  TASK_PRIORITY_OPTIONS,
} from "@/lib/work/constants";
import { isOverdue, type TaskSnapshot } from "@/lib/work/task-snapshot";
import { todayDateString } from "@/lib/sales/use-opportunity-attributes";

const PRIORITY_CLASS: Record<string, string> = {
  urgent: "text-red-400",
  high: "text-orange-400",
  medium: "text-[var(--theme-text-secondary)]",
  low: "text-[var(--theme-text-muted)]",
};

export function TaskCardBody({
  task,
  snapshot,
}: {
  task: WorkItem;
  snapshot: TaskSnapshot;
}) {
  const today = todayDateString();
  const overdue =
    isOverdue(snapshot.due_date, today) && task.state.category !== "done";
  return (
    <div className="work-task-card rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)] hover:bg-[var(--theme-bg-hover)] p-3 cursor-pointer text-left transition-colors">
      <p className="work-task-card-title text-sm font-medium text-[var(--theme-text-primary)] leading-snug">
        {task.title}
      </p>
      <div className="work-task-card-meta mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
        {snapshot.project && (
          <span className="work-task-chip rounded bg-[var(--theme-bg-tertiary)] px-1.5 py-0.5 text-[var(--theme-text-secondary)]">
            {labelizeOptionKey(snapshot.project)}
          </span>
        )}
        {snapshot.priority &&
          (TASK_PRIORITY_OPTIONS as readonly string[]).includes(
            snapshot.priority,
          ) && (
            <span
              className={`work-task-priority font-medium ${PRIORITY_CLASS[snapshot.priority]}`}
            >
              {labelizeOptionKey(snapshot.priority)}
            </span>
          )}
        {snapshot.due_date && (
          <span
            className={`work-task-due ${
              overdue ? "text-red-400" : "text-[var(--theme-text-muted)]"
            }`}
          >
            {snapshot.due_date}
          </span>
        )}
        {snapshot.assignee === "claude" && (
          <span className="work-task-claude rounded bg-[var(--ctx-accent-primary,#FF385C)]/15 px-1.5 py-0.5 text-[var(--ctx-accent-primary,#FF385C)]">
            Claude
          </span>
        )}
      </div>
    </div>
  );
}
