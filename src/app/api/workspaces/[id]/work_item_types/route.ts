import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/server/api-error";
import {
  STUB_WORKSPACE,
  listRecordTypes,
  serializeWorkItemType,
} from "@/server/bootstrap";
import { requireApiSession } from "@/server/api-auth";

/** `GET /api/workspaces/:id/work_item_types` → `{ data }`. */

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
  if (id !== STUB_WORKSPACE.id) {
    return apiError(404, "not_found", `Workspace not found: ${id}`);
  }
  const rows = await listRecordTypes();
  return NextResponse.json({ data: rows.map(serializeWorkItemType) });
}
