import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/server/api-error";
import {
  STUB_WORKSPACE,
  listWorkflows,
  serializeWorkflow,
} from "@/server/bootstrap";

/** `GET /api/workspaces/:id/workflows` → `{ data }`. */

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;
  if (id !== STUB_WORKSPACE.id) {
    return apiError(404, "not_found", `Workspace not found: ${id}`);
  }
  const rows = await listWorkflows();
  return NextResponse.json({ data: rows.map(serializeWorkflow) });
}
