import { asc, eq } from "drizzle-orm";
import { db, recordTypes, workflows, workflowStages } from "@/db";
import { CRM_WORKSPACE_ID } from "./constants";

/**
 * Bootstrap family — workspaces / workflows / workflow_states /
 * work_item_types. Single tenant: the workspace is a static stub (no
 * table), workflows + stages + types come from the seeded template
 * skeleton. Wire shapes mirror the platform response DTOs the
 * untouched frontend clients parse.
 */

/** Fixed timestamp for the stub workspace (fork date) — the FE only
 *  renders these, nothing sorts on them. */
const STUB_TIMESTAMP = "2026-07-27T00:00:00.000Z";

/** The single workspace every list/get serves and every record stamps.
 *  `key: "CRM"` matches the `CRM-<n>` identifier prefix; `module_keys:
 *  ["sales"]` keeps the sales module surfaces enabled (the FE derives
 *  enabled modules from the union across workspaces). */
export const STUB_WORKSPACE = {
  id: CRM_WORKSPACE_ID,
  organization_id: "org_crm",
  key: "CRM",
  name: "CRM",
  metadata: { module_key: "sales", template_key: "sales-pipeline" },
  module_keys: ["sales"],
  expires_at: null,
  created_at: STUB_TIMESTAMP,
  updated_at: STUB_TIMESTAMP,
} as const;

type WorkflowRow = typeof workflows.$inferSelect;
type StageRow = typeof workflowStages.$inferSelect;
type TypeRow = typeof recordTypes.$inferSelect;

export function serializeWorkflow(row: WorkflowRow): Record<string, unknown> {
  return {
    id: row.id,
    workspace_id: CRM_WORKSPACE_ID,
    key: row.key,
    name: row.name,
    description: row.description,
    is_default: row.isDefault,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function serializeStage(row: StageRow): Record<string, unknown> {
  return {
    id: row.id,
    workflow_id: row.workflowId,
    key: row.key,
    name: row.name,
    category: row.category,
    position: row.position,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function serializeWorkItemType(row: TypeRow): Record<string, unknown> {
  return {
    id: row.id,
    workspace_id: CRM_WORKSPACE_ID,
    key: row.key,
    name: row.name,
    description: row.description,
    default_workflow_id: row.workflowId,
    template_id: null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function listWorkflows(): Promise<WorkflowRow[]> {
  return db.select().from(workflows).orderBy(asc(workflows.key));
}

export async function listStagesForWorkflow(
  workflowId: string,
): Promise<StageRow[]> {
  return db
    .select()
    .from(workflowStages)
    .where(eq(workflowStages.workflowId, workflowId))
    .orderBy(asc(workflowStages.position));
}

export async function listRecordTypes(): Promise<TypeRow[]> {
  return db.select().from(recordTypes).orderBy(asc(recordTypes.key));
}
