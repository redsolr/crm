/**
 * Attributes API Client.
 *
 * Hits `/api/work_item_types/:wit/attribute_definitions` for the
 * type-level custom-field declarations, and `/api/work_items/:wi/
 * attribute_values` for the per-row values. Per-row mutations go
 * through `PUT /work_items/:wi/attribute_values/:def` (upsert) and
 * `DELETE` (unset).
 */

import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";
import { unwrapAttributeValue } from "./attribute-value-envelope";
import type {
  AttributeDefinition,
  AttributeValue,
} from "./generated/api/models";

/**
 * Every consumer in this app works with the BARE typed value, so this
 * client unwraps the platform's storage envelope once, here at the
 * boundary (see `attribute-value-envelope.ts` for the shape).
 */
export function unwrapAttributeValueRow(row: AttributeValue): AttributeValue {
  const bare = unwrapAttributeValue(row.value);
  return bare === row.value ? row : { ...row, value: bare };
}

class AttributesApiClient extends BaseApiClient {
  async listDefinitions(
    workItemTypeId: string,
  ): Promise<{ data: AttributeDefinition[] }> {
    return this.request<{ data: AttributeDefinition[] }>(
      `/work_item_types/${workItemTypeId}/attribute_definitions`,
    );
  }

  async listValues(
    workItemId: string,
  ): Promise<{ data: AttributeValue[] }> {
    const res = await this.request<{ data: AttributeValue[] }>(
      `/work_items/${workItemId}/attribute_values`,
    );
    return { data: res.data.map(unwrapAttributeValueRow) };
  }

  async upsertValue(
    workItemId: string,
    definitionId: string,
    value: unknown,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{ value: AttributeValue }> {
    const res = await this.request<{ value: AttributeValue }>(
      `/work_items/${workItemId}/attribute_values/${definitionId}`,
      {
        method: "PUT",
        body: JSON.stringify({ value }),
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
    return { value: unwrapAttributeValueRow(res.value) };
  }

  /**
   * Sync single-item LLM compute for an AI-computed column (a
   * definition carrying an `enrichment` config). A suggestion with
   * provenance, never a clobber — a human (`manual`) value yields
   * `outcome: 'skipped_manual_override'` and stays untouched.
   */
  async computeValue(
    workItemId: string,
    definitionId: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<{
    outcome: "computed" | "skipped_manual_override" | "failed";
    value: AttributeValue | null;
  }> {
    const res = await this.request<{
      outcome: "computed" | "skipped_manual_override" | "failed";
      value: AttributeValue | null;
    }>(
      `/work_items/${workItemId}/attribute_values/${definitionId}/compute`,
      {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
    return {
      outcome: res.outcome,
      value: res.value === null ? null : unwrapAttributeValueRow(res.value),
    };
  }

  async unsetValue(
    workItemId: string,
    definitionId: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<void> {
    return this.request<void>(
      `/work_items/${workItemId}/attribute_values/${definitionId}`,
      {
        method: "DELETE",
        headers: { "Idempotency-Key": idempotencyKey },
      },
    );
  }
}

export const attributesApi = new AttributesApiClient();
