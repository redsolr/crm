import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/server/api-error";
import { listValuesForItem, serializeValue } from "@/server/attributes";
import { loadWorkItem } from "@/server/work-items";
import { requireApiSession } from "@/server/api-auth";

/** `GET /api/work_items/:id/attribute_values` → `{ data }` (values in
 *  the platform's `{ value: <typed> }` storage envelope). */

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const gate = await requireApiSession();
  if (!gate.ok) return gate.response;
  const { id } = await context.params;
  const item = await loadWorkItem(id);
  if (!item) return apiError(404, "not_found", `Work item not found: ${id}`);
  const values = await listValuesForItem(id);
  return NextResponse.json({ data: values.map(serializeValue) });
}
