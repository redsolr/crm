/**
 * Shared attribute-value editing helpers — the string ⇄ typed-value
 * bridge every attribute editor rides (the detail-view AttributeEditor
 * and the CrmRecordTable inline cell editors).
 *
 * Extracted from SalesOpportunityDetailView (Attio table slice,
 * 2026-07-18) so the per-`data_type` parse/stringify logic exists
 * exactly once.
 */

import type { AttributeDefinition } from "@/lib/generated/api/models";

/** Render any stored attribute value as an editable string. */
export function stringifyAttributeValue(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
  try {
    return JSON.stringify(raw);
  } catch (err) {
    console.warn(
      "[attribute-editing] failed to stringify attribute value:",
      err,
    );
    return "";
  }
}

/** Parse an editor string back into the wire value for a data type.
 *  Empty string → null (unset). Non-finite numbers → null. Booleans
 *  round-trip the checkbox's "true"/"false" strings. */
export function parseAttributeValueForType(
  raw: string,
  dataType: AttributeDefinition["data_type"],
): unknown {
  if (raw === "") return null;
  if (dataType === "number") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }
  if (dataType === "boolean") {
    return raw === "true";
  }
  return raw;
}
