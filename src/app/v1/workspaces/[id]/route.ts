import { NextResponse, type NextRequest } from "next/server";
import { apiError } from "@/server/api-error";
import { STUB_WORKSPACE } from "@/server/bootstrap";

/** `GET /v1/workspaces/:id` — bare workspace object (platform DTO). */

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
  return NextResponse.json(STUB_WORKSPACE);
}
