import { NextResponse } from "next/server";
import { apiError } from "@/server/api-error";
import { requireApiSession } from "@/server/api-auth";
import { deleteMemoryById } from "@/server/memories";

/** `DELETE /api/memories/:id` → `{ deleted: true }` — /account list row. */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const gate = await requireApiSession();
  if (!gate.ok) return gate.response;
  const { id } = await context.params;
  const deleted = await deleteMemoryById(id);
  if (!deleted) {
    return apiError(404, "not_found", "No memory with that id.");
  }
  return NextResponse.json({ deleted: true });
}
