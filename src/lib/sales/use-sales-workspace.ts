"use client";

/**
 * Sales-workspace resolution + per-template metadata.
 *
 * Workspace rename arc (2026-05-27): Sales work_items live in the
 * workspace bound on the user's JWT/PAT (or API key). The `project`
 * primitive was retired — Sales is reached by querying the current
 * workspace's `sales-pipeline`-templated work_items (the seed fixture
 * applies the template to the `Default` workspace). The bundle resolves
 * the active workspace and pulls its workflows / types / attribute
 * definitions (all workspace-scoped on the platform).
 */

import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useAppContextStore } from "@/stores/app-context.store";
import { workflowsApi, type Workflow, type WorkflowState } from "@/lib/workflowsApi";
import type { Workspace } from "@/lib/workspacesApi";
import {
  workItemTypesApi,
  type WorkItemTypeRow,
} from "@/lib/workItemTypesApi";
import { attributesApi } from "@/lib/attributesApi";
import type { AttributeDefinition } from "@/lib/generated/api/models";
import { queryKeys } from "@/queries/query-keys";

/** Snapshot of everything the Sales UI needs to render in one shot.
 *  Workflows and types are cached at the React-Query level so views
 *  + modals never re-fetch them per-mount. */
export interface SalesWorkspaceBundle {
  workspace: Workspace;
  workflows: Workflow[];
  states: Record<string, WorkflowState[]>;
  workItemTypes: WorkItemTypeRow[];
  /** Attribute definitions keyed by work-item-type ID. */
  attributeDefinitionsByType: Record<string, AttributeDefinition[]>;
}

/**
 * Pulls the whole template skeleton (workflows + states + types +
 * attribute definitions) for the active workspace. Drives both the
 * pipeline grouping and the opportunity attribute editor.
 */
export function useSalesWorkspaceBundle(enabled = true) {
  const workspace = useAppContextStore((s) => s.currentWorkspace);
  const workspaceId = workspace?.id;

  const skeletonEnabled = enabled && !!workspaceId;

  const workflowsQuery = useQuery({
    queryKey: workspaceId
      ? queryKeys.sales.workflows(workspaceId)
      : queryKeys.sales.all,
    queryFn: async () => {
      if (!workspaceId) return { data: [] as Workflow[] };
      return workflowsApi.listWorkspaceWorkflows(workspaceId);
    },
    enabled: skeletonEnabled,
    staleTime: 5 * 60 * 1000,
  });

  const typesQuery = useQuery({
    queryKey: workspaceId
      ? queryKeys.sales.workItemTypes(workspaceId)
      : queryKeys.sales.all,
    queryFn: async () => {
      if (!workspaceId) return { data: [] as WorkItemTypeRow[] };
      return workItemTypesApi.listWorkspaceWorkItemTypes(workspaceId);
    },
    enabled: skeletonEnabled,
    staleTime: 5 * 60 * 1000,
  });

  const workflowIds = useMemo(
    () => (workflowsQuery.data?.data ?? []).map((w) => w.id),
    [workflowsQuery.data],
  );

  const statesQueries = useStatesByWorkflowIds(workflowIds);

  const typeIds = useMemo(
    () => (typesQuery.data?.data ?? []).map((t) => t.id),
    [typesQuery.data],
  );

  const attrQueries = useAttributeDefinitionsByTypeIds(typeIds);

  const bundle = useMemo<SalesWorkspaceBundle | null>(() => {
    const workflows = workflowsQuery.data?.data ?? [];
    const types = typesQuery.data?.data ?? [];
    if (!workspace) return null;

    const states: Record<string, WorkflowState[]> = {};
    for (const wf of workflows) {
      states[wf.id] = statesQueries[wf.id]?.data?.data ?? [];
    }

    const attributeDefinitionsByType: Record<string, AttributeDefinition[]> = {};
    for (const t of types) {
      attributeDefinitionsByType[t.id] = attrQueries[t.id]?.data?.data ?? [];
    }

    return {
      workspace,
      workflows,
      states,
      workItemTypes: types,
      attributeDefinitionsByType,
    };
  }, [
    workspace,
    workflowsQuery.data,
    typesQuery.data,
    statesQueries,
    attrQueries,
  ]);

  const isLoading =
    workflowsQuery.isLoading ||
    typesQuery.isLoading ||
    Object.values(statesQueries).some((q) => q.isLoading) ||
    Object.values(attrQueries).some((q) => q.isLoading);

  return {
    bundle,
    isLoading,
  };
}

// ---------------------------------------------------------------------------
// Internal: dynamic-id parallel queries
// ---------------------------------------------------------------------------

function useStatesByWorkflowIds(workflowIds: string[]) {
  const queries = useQueries({
    queries: workflowIds.map((id) => ({
      queryKey: queryKeys.sales.workflowStates(id),
      queryFn: () => workflowsApi.listStates(id),
      staleTime: 5 * 60 * 1000,
    })),
  });
  return useMemo(() => {
    const map: Record<string, (typeof queries)[number]> = {};
    workflowIds.forEach((id, i) => {
      map[id] = queries[i]!;
    });
    return map;
  }, [workflowIds, queries]);
}

function useAttributeDefinitionsByTypeIds(typeIds: string[]) {
  const queries = useQueries({
    queries: typeIds.map((id) => ({
      queryKey: queryKeys.sales.attributeDefinitions(id),
      queryFn: () => attributesApi.listDefinitions(id),
      staleTime: 5 * 60 * 1000,
    })),
  });
  return useMemo(() => {
    const map: Record<string, (typeof queries)[number]> = {};
    typeIds.forEach((id, i) => {
      map[id] = queries[i]!;
    });
    return map;
  }, [typeIds, queries]);
}
