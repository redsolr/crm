"use client";

/**
 * Adapts tasks onto the shared <Board>: cards grouped by task-workflow
 * stage, stage moves through the conflict-retrying transition hook,
 * per-column inline create (stamped with the active project space).
 * Same adapter pattern as use-sales-board-source; no closed-stage
 * interception — canceling a task needs no reason modal.
 */

import React from "react";
import type { WorkItem } from "@/lib/workItemsApi";
import type { AttributeDefinition } from "@/lib/generated/api/models";
import { useTransitionWorkItem } from "@/lib/sales/use-sales-mutations";
import { useCreateTask } from "@/lib/work/use-work";
import {
  TASK_STATE_KEYS,
  TASK_STATE_LABELS,
  TASK_STATE_ORDER,
} from "@/lib/work/constants";
import type {
  BoardColumnDef,
  BoardDataSource,
} from "@/components/board/board-data-source";
import type { TaskSnapshot } from "@/lib/work/task-snapshot";
import { TaskCardBody } from "./TaskCard";

export function useTaskBoardSource({
  workspaceId,
  tasks,
  snapshotsById,
  definitions,
  showCanceled,
  activeProject,
  onOpenTask,
}: {
  workspaceId: string;
  tasks: WorkItem[];
  snapshotsById: Record<string, TaskSnapshot>;
  definitions: AttributeDefinition[];
  showCanceled: boolean;
  /** Active space, or null for the All view. Stamped onto composer
   *  creates ("other" in the All view — visible on the card, editable
   *  in the task modal). */
  activeProject: string | null;
  onOpenTask: (task: WorkItem) => void;
}): BoardDataSource<WorkItem> {
  const transition = useTransitionWorkItem();
  const createTask = useCreateTask();

  const stages = showCanceled
    ? TASK_STATE_ORDER
    : TASK_STATE_ORDER.filter((s) => s !== TASK_STATE_KEYS.canceled);

  const columns: BoardColumnDef[] = stages.map((key) => ({
    id: key,
    title: TASK_STATE_LABELS[key] ?? key,
    isDone: key === TASK_STATE_KEYS.done,
  }));

  const cardsByColumn: Record<string, WorkItem[]> = {};
  for (const key of stages) cardsByColumn[key] = [];
  for (const task of tasks) {
    const key = task.state.key;
    if (key in cardsByColumn) cardsByColumn[key]!.push(task);
  }

  return {
    columns,
    cardsByColumn,
    cloneClassName: "w-72",
    moveCard: (id, toStage) => {
      const task = tasks.find((t) => t.id === id);
      if (!task || toStage === task.state.key) return Promise.resolve(true);
      transition.mutate({ id, version: task.version, state_key: toStage });
      return Promise.resolve(true);
    },
    onCreate: (columnId, title) => {
      const trimmed = title.trim();
      if (!trimmed) return;
      createTask.mutate({
        title: trimmed,
        workspace_id: workspaceId,
        state_key: columnId,
        definitions,
        attributes: { project: activeProject ?? "other" },
      });
    },
    canCreateInColumn: (columnId) => columnId !== TASK_STATE_KEYS.canceled,
    renderCard: (task, drag) => (
      <div
        ref={drag.setNodeRef}
        style={drag.style}
        data-card-id={task.id}
        data-testid="work-task-card"
        data-task-id={task.id}
        role="button"
        tabIndex={0}
        {...drag.attributes}
        {...drag.listeners}
        onClick={(e) => {
          if (drag.isDragging) return;
          e.stopPropagation();
          onOpenTask(task);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onOpenTask(task);
          }
        }}
        className={`rounded-lg ${
          drag.isSelected || drag.isNestTarget
            ? "ring-2 ring-inset ring-[var(--ctx-accent-primary,#FF385C)]"
            : ""
        }`}
      >
        <TaskCardBody
          task={task}
          snapshot={
            snapshotsById[task.id] ?? {
              project: null,
              priority: null,
              due_date: null,
              assignee: null,
            }
          }
        />
      </div>
    ),
  };
}
