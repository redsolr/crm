import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/server/api-error";
import {
  listChildren,
  loadWorkItem,
  serializeWorkItem,
} from "@/server/work-items";

/** `GET /api/work_items/:id/subtasks` — children via `parent_id`. */

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;
  const parent = await loadWorkItem(id);
  if (!parent) return apiError(404, "not_found", `Work item not found: ${id}`);

  const children = await listChildren(id);
  return NextResponse.json({
    work_items: children.map(serializeWorkItem),
  });
}
