"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DEFAULT_WORKFLOW_STATUSES,
  STATUS_DOT_COLORS,
  type StatusCategory,
  type WorkflowStatus,
} from "@/lib/task-constants";
import {
  workflowsApi,
  type WorkflowState,
} from "@/lib/workflowsApi";
import { useAuthStore } from "@/stores/auth.store";
import { useAppContextStore } from "@/stores/app-context.store";
import { queryKeys } from "@/queries/query-keys";

export interface UseWorkflowStatusesOptions {
  /**
   * Workspace id whose workflow states drive the columns. Defaults to
   * the currently-selected workspace from `useAppContextStore` when
   * omitted. Workflow states are workspace-scoped on the platform.
   */
  workspace_id?: string;
}

/**
 * Maps a platform `WorkflowState.category` to the FE `StatusCategory`.
 * The platform buckets are `not_started | active | done | dead`; the FE
 * board/backlog model uses `backlog | active | done | cancelled`.
 */
function toStatusCategory(category: WorkflowState["category"]): StatusCategory {
  switch (category) {
    case "not_started":
      return "backlog";
    case "active":
      return "active";
    case "done":
      return "done";
    case "dead":
      return "cancelled";
  }
}

/**
 * Resolves the workspace's workflow states (via `workflowsApi`) and maps
 * them to the FE `WorkflowStatus` shape. The default workflow is used
 * (or the first workflow if none is flagged default). Returns `null`
 * while loading or when no custom states resolve, so consumers fall
 * back to `DEFAULT_WORKFLOW_STATUSES`.
 */
function useWorkspaceWorkflowStates(
  workspaceId: string | undefined,
): WorkflowState[] | null {
  const isAuthenticated = useAuthStore((s) => !!s.user);

  const workflowsQuery = useQuery({
    queryKey: workspaceId
      ? queryKeys.workflows.byWorkspace(workspaceId)
      : queryKeys.workflows.all,
    queryFn: async () => {
      if (!workspaceId) return [];
      const { data } = await workflowsApi.listWorkspaceWorkflows(workspaceId);
      return data;
    },
    enabled: isAuthenticated && !!workspaceId,
    staleTime: 5 * 60 * 1000,
  });

  const defaultWorkflow = useMemo(() => {
    const workflows = workflowsQuery.data ?? [];
    if (workflows.length === 0) return undefined;
    return workflows.find((w) => w.is_default) ?? workflows[0];
  }, [workflowsQuery.data]);

  const statesQuery = useQuery({
    queryKey: defaultWorkflow
      ? queryKeys.workflows.states(defaultWorkflow.id)
      : queryKeys.workflows.all,
    queryFn: async () => {
      if (!defaultWorkflow) return [];
      const { data } = await workflowsApi.listStates(defaultWorkflow.id);
      return data;
    },
    enabled: isAuthenticated && !!defaultWorkflow,
    staleTime: 5 * 60 * 1000,
  });

  const states = statesQuery.data;
  if (!states || states.length === 0) return null;
  return states;
}

/**
 * Returns the workflow statuses for the given workspace (or the
 * currently-selected workspace from `useAppContextStore` when
 * `workspace_id` is omitted).
 *
 * Resolution: the workspace's default-workflow states when present,
 * otherwise `DEFAULT_WORKFLOW_STATUSES`. States are sorted by `position`
 * so board columns render in the author's intended order.
 */
export function useWorkflowStatuses(
  options: UseWorkflowStatusesOptions = {},
): WorkflowStatus[] {
  const fallbackWorkspaceId = useAppContextStore((s) => s.currentWorkspace?.id);
  const workspaceId = options.workspace_id ?? fallbackWorkspaceId;
  const states = useWorkspaceWorkflowStates(workspaceId);

  return useMemo(() => {
    if (!states || states.length === 0) return DEFAULT_WORKFLOW_STATUSES;
    return [...states]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        key: s.key,
        name: s.name,
        category: toStatusCategory(s.category),
        position: s.position,
      }));
  }, [states]);
}

/**
 * True once the workspace's real workflow states have resolved. Lets the board
 * refuse to offer task creation against the fabricated `DEFAULT_WORKFLOW_STATUSES`
 * fallback: creating with a default state key (e.g. `todo`) that the workspace's
 * workflow never registered fails server-side ("Status \"todo\" is not registered
 * in the workflow…"). When this is `false` the workspace genuinely has no
 * resolvable workflow (or states are still loading), so the create affordance is
 * withheld rather than guessed. Reuses the same query as `useWorkflowStatuses`
 * (react-query dedupes), so it costs no extra request.
 */
export function useHasResolvedWorkflowStates(
  options: UseWorkflowStatusesOptions = {},
): boolean {
  const fallbackWorkspaceId = useAppContextStore((s) => s.currentWorkspace?.id);
  const workspaceId = options.workspace_id ?? fallbackWorkspaceId;
  const states = useWorkspaceWorkflowStates(workspaceId);
  return !!states && states.length > 0;
}

/** Derives board columns from workflow statuses (active + done categories). */
export function useBoardColumns(options: UseWorkflowStatusesOptions = {}) {
  const statuses = useWorkflowStatuses(options);

  return useMemo(() => {
    // Board shows active + done statuses (not backlog or cancelled)
    const boardStatuses = statuses.filter(
      (s) => s.category === "active" || s.category === "done",
    );

    return boardStatuses.map((s) => ({
      id: s.key,
      title: s.name.toUpperCase(),
      accent: STATUS_DOT_COLORS[s.key] || "#579dff",
    }));
  }, [statuses]);
}

/** Maps any string to the nearest board column id. */
export function useStatusToColumnMap(options: UseWorkflowStatusesOptions = {}) {
  const statuses = useWorkflowStatuses(options);

  return useMemo(() => {
    const activeKeys = new Set(
      statuses.filter((s) => s.category === "active").map((s) => s.key),
    );
    const doneKeys = new Set(
      statuses.filter((s) => s.category === "done").map((s) => s.key),
    );

    // Find first active and done keys for fallback
    const firstActive =
      statuses.find((s) => s.category === "active")?.key || "todo";
    const firstDone =
      statuses.find((s) => s.category === "done")?.key || "done";

    return (status: string): string => {
      if (activeKeys.has(status) || doneKeys.has(status)) return status;
      // Backlog → first active column, cancelled → done column
      const ws = statuses.find((s) => s.key === status);
      if (!ws) return firstActive;
      if (ws.category === "backlog") return firstActive;
      if (ws.category === "cancelled") return firstDone;
      return firstActive;
    };
  }, [statuses]);
}
