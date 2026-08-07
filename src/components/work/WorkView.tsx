"use client";

/**
 * Work view — the internal org-management surface (design brief:
 * docs/design-org-management-pivot.md, founder go 2026-08-06).
 *
 * Jira mapping: "spaces" are the project options on the task type —
 * the pills filter one board, they don't switch context. The board is
 * the shared <Board> driven by useTaskBoardSource; stage moves reuse
 * the conflict-retrying transition machinery, so tasks behave exactly
 * like pipeline cards under concurrency + realtime invalidation.
 *
 * INTERNAL-ONLY by intent (brief guard): if the CRM ever grows
 * customer seats or demo modes, this surface must be flagged off for
 * them before that ships — the external product story stays "a CRM".
 */

import { useMemo, useState } from "react";
import { useSalesWorkspaceBundle } from "@/lib/sales/use-sales-workspace";
import { useAttributeValuesByItem } from "@/lib/sales/use-item-attribute-values";
import { useTasksQuery } from "@/lib/work/use-work";
import {
  labelizeOptionKey,
  TASK_PROJECT_OPTIONS,
  WORK_TYPE_KEYS,
} from "@/lib/work/constants";
import { taskSnapshot, type TaskSnapshot } from "@/lib/work/task-snapshot";
import { Board } from "@/components/board/Board";
import { CrmViewSkeleton } from "@/components/sales/crm/CrmViewSkeleton";
import type { WorkItem } from "@/lib/workItemsApi";
import { useTaskBoardSource } from "./use-task-board-source";
import { TaskEditModal } from "./TaskEditModal";

export function WorkView() {
  const { bundle, isLoading: bundleLoading } = useSalesWorkspaceBundle();
  const workspaceId = bundle?.workspace.id;
  const tasksQuery = useTasksQuery(workspaceId);
  const tasks = useMemo(
    () => tasksQuery.data?.data ?? [],
    [tasksQuery.data?.data],
  );
  const { valuesById } = useAttributeValuesByItem(tasks);

  const [activeSpace, setActiveSpace] = useState<string | null>(null);
  const [showCanceled, setShowCanceled] = useState(false);
  const [openTask, setOpenTask] = useState<WorkItem | null>(null);

  const taskType = bundle?.workItemTypes.find(
    (t) => t.key === WORK_TYPE_KEYS.task,
  );
  const taskDefs = useMemo(
    () =>
      taskType ? (bundle?.attributeDefinitionsByType[taskType.id] ?? []) : [],
    [bundle, taskType],
  );

  const snapshotsById = useMemo(() => {
    const map: Record<string, TaskSnapshot> = {};
    for (const task of tasks) {
      map[task.id] = taskSnapshot(valuesById[task.id], taskDefs);
    }
    return map;
  }, [tasks, valuesById, taskDefs]);

  const visibleTasks = useMemo(
    () =>
      activeSpace === null
        ? tasks
        : tasks.filter((t) => snapshotsById[t.id]?.project === activeSpace),
    [tasks, snapshotsById, activeSpace],
  );

  const source = useTaskBoardSource({
    workspaceId: workspaceId ?? "",
    tasks: visibleTasks,
    snapshotsById,
    definitions: taskDefs,
    showCanceled,
    activeProject: activeSpace,
    onOpenTask: setOpenTask,
  });

  if (bundleLoading || (tasksQuery.isLoading && !bundle)) {
    return <CrmViewSkeleton title="Work" testId="work-view-skeleton" />;
  }

  // Defensive: the task type only exists after `npm run db:seed` (local)
  // / the template seed run (Neon). Non-actionable by design — mirrors
  // the pipeline's missing-container state.
  if (bundle && !taskType) {
    return (
      <div className="work-view-unseeded flex h-full items-center justify-center p-8 text-sm text-[var(--theme-text-muted)]">
        The task template is not seeded in this database yet.
      </div>
    );
  }

  const openCount = tasks.filter(
    (t) => t.state.category !== "done" && t.state.category !== "dead",
  ).length;

  return (
    <div className="work-view flex h-full min-h-0 flex-col" data-testid="work-view">
      <header className="work-view-header flex flex-wrap items-center gap-3 px-4 pt-4 pb-3">
        <h1 className="work-view-title text-lg font-semibold text-[var(--theme-text-primary)]">
          Work
        </h1>
        <span className="work-view-count text-xs text-[var(--theme-text-muted)]">
          {openCount} open
        </span>
        <div className="work-view-spaces flex flex-wrap items-center gap-1.5" data-testid="work-spaces">
          <SpacePill
            label="All"
            active={activeSpace === null}
            onClick={() => setActiveSpace(null)}
            testId="work-space-all"
          />
          {TASK_PROJECT_OPTIONS.map((space) => (
            <SpacePill
              key={space}
              label={labelizeOptionKey(space)}
              active={activeSpace === space}
              onClick={() =>
                setActiveSpace(activeSpace === space ? null : space)
              }
              testId={`work-space-${space}`}
            />
          ))}
        </div>
        <button
          type="button"
          className={`work-view-show-canceled ml-auto text-xs transition-colors ${
            showCanceled
              ? "text-[var(--theme-text-secondary)]"
              : "text-[var(--theme-text-muted)] hover:text-[var(--theme-text-secondary)]"
          }`}
          onClick={() => setShowCanceled(!showCanceled)}
          data-testid="work-show-canceled"
        >
          {showCanceled ? "Hide canceled" : "Show canceled"}
        </button>
      </header>
      <div className="work-view-board min-h-0 flex-1 overflow-x-auto px-4 pb-4">
        <Board source={source} />
      </div>
      {openTask && (
        <TaskEditModal
          task={openTask}
          definitions={taskDefs}
          values={valuesById[openTask.id] ?? []}
          onClose={() => setOpenTask(null)}
        />
      )}
    </div>
  );
}

function SpacePill({
  label,
  active,
  onClick,
  testId,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      data-active={active ? "true" : undefined}
      className={`work-space-pill rounded-full border px-2.5 py-1 text-xs transition-colors ${
        active
          ? "border-[var(--ctx-accent-primary,#FF385C)] text-[var(--theme-text-primary)]"
          : "border-[var(--theme-border-secondary)] text-[var(--theme-text-muted)] hover:text-[var(--theme-text-secondary)]"
      }`}
    >
      {label}
    </button>
  );
}
