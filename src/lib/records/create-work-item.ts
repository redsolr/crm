/**
 * Shared create-with-attributes helper — POST the work item, then fan
 * out one attribute-value PUT per bag entry. Extracted from
 * use-sales-mutations (2026-08-06) when the work module became the
 * second consumer; both modules' create hooks wrap this.
 */

import {
  workItemsApi,
  type CreateWorkItemRequest,
  type WorkItem,
} from "@/lib/workItemsApi";
import { attributesApi } from "@/lib/attributesApi";
import type { AttributeDefinition } from "@/lib/generated/api/models";

/** Map of attribute key → value for a single create call. The caller
 *  fans them out as one PUT per key after the work_item POST settles. */
export type AttributeBag = Record<string, unknown>;

export interface CreateOptions<TKey extends string> {
  title: string;
  description?: string;
  workspace_id: string;
  parent_id?: string;
  state_key?: TKey;
  /** Explicit manual rank (insert-between-rows create). Omitted ⇒ end. */
  position?: number;
  attributes?: AttributeBag;
  /** Type definitions for the work_item kind we're creating —
   *  needed to map `attribute_bag[key]` → `definition.id` for the
   *  follow-up `PUT /work_items/:wi/attribute_values/:def` calls. */
  definitions: AttributeDefinition[];
}

export async function createAndStampAttributes(
  type_key: string,
  options: CreateOptions<string>,
): Promise<WorkItem> {
  const request: CreateWorkItemRequest = {
    title: options.title,
    description: options.description,
    workspace_id: options.workspace_id,
    parent_id: options.parent_id,
    state_key: options.state_key,
    position: options.position,
    type_key,
  };
  const { workItem } = await workItemsApi.createWorkItem(request);

  const defs = options.definitions ?? [];
  const bag = options.attributes ?? {};
  const writes = Object.entries(bag).flatMap(([key, value]) => {
    if (value === undefined || value === null || value === "") return [];
    const def = defs.find((d) => d.key === key);
    if (!def) return [];
    return [attributesApi.upsertValue(workItem.id, def.id, value)];
  });
  if (writes.length > 0) {
    await Promise.all(writes);
  }
  return workItem;
}
