import { NextResponse, type NextRequest } from "next/server";
import { unwrapAttributeValue } from "@/lib/attribute-value-envelope";
import { apiError, readJsonBody } from "@/server/api-error";
import {
  deleteValue,
  findDefinition,
  serializeValue,
  upsertValue,
  validateBareValue,
} from "@/server/attributes";
import { loadWorkItem } from "@/server/work-items";

/**
 * `PUT` (upsert) / `DELETE` (unset) `/api/work_items/:id/
 * attribute_values/:definitionId`. Incoming `value` may be bare or
 * wrapped — the shared envelope helper normalizes it, mirroring the
 * platform's `validateAttributeValue` envelope handling.
 */

interface RouteContext {
  params: Promise<{ id: string; definitionId: string }>;
}

export async function PUT(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { id, definitionId } = await context.params;

  const item = await loadWorkItem(id);
  if (!item) return apiError(404, "not_found", `Work item not found: ${id}`);

  const definition = await findDefinition(definitionId);
  if (!definition) {
    return apiError(404, "not_found", `Attribute definition not found: ${definitionId}`);
  }
  if (definition.workItemTypeId !== item.type.id) {
    return apiError(
      422,
      "validation_failed",
      `Definition ${definition.key} does not belong to type ${item.type.key}`,
    );
  }

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const raw = parsedBody.body;
  if (typeof raw !== "object" || raw === null || !("value" in raw)) {
    return apiError(422, "validation_failed", "Body must be { value }");
  }
  const bare = unwrapAttributeValue((raw as { value: unknown }).value);

  const validationError = validateBareValue(definition, bare);
  if (validationError !== null) {
    return apiError(422, "validation_failed", validationError);
  }

  const row = await upsertValue(id, definitionId, bare);
  return NextResponse.json({ value: serializeValue(row) });
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse | Response> {
  const { id, definitionId } = await context.params;

  const item = await loadWorkItem(id);
  if (!item) return apiError(404, "not_found", `Work item not found: ${id}`);
  const definition = await findDefinition(definitionId);
  if (!definition) {
    return apiError(404, "not_found", `Attribute definition not found: ${definitionId}`);
  }

  // Idempotent unset — deleting an absent value is still 204.
  await deleteValue(id, definitionId);
  return new Response(null, { status: 204 });
}
