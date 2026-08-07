import { NextResponse, type NextRequest } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db, comments } from "@/db";
import { apiError } from "@/server/api-error";
import { authorPayloadFor, serializeComment } from "@/server/comments";
import { loadWorkItem } from "@/server/work-items";
import { requireApiSession } from "@/server/api-auth";

/** `GET /api/work_items/:id/comments` → `{ data: [{ comment, author }] }`. */

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

  const rows = await db
    .select()
    .from(comments)
    .where(eq(comments.workItemId, id))
    .orderBy(asc(comments.createdAt), asc(comments.id));

  return NextResponse.json({
    data: rows.map((row) => ({
      comment: serializeComment(row),
      author: authorPayloadFor(row),
    })),
  });
}
