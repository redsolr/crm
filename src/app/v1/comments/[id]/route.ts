import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, comments } from "@/db";
import { apiError, readJsonBody } from "@/server/api-error";
import { serializeComment } from "@/server/comments";

/** `GET` / `PUT` / `DELETE` `/v1/comments/:id`. */

interface RouteContext {
  params: Promise<{ id: string }>;
}

const updateCommentSchema = z.object({
  content: z.string().min(1).max(20_000),
  mentions: z.array(z.string()).optional(),
});

async function findComment(id: string) {
  return db.query.comments.findFirst({ where: (t, { eq: eqOp }) => eqOp(t.id, id) });
}

export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;
  const row = await findComment(id);
  if (!row) return apiError(404, "not_found", `Comment not found: ${id}`);
  return NextResponse.json({ comment: serializeComment(row) });
}

export async function PUT(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;
  const row = await findComment(id);
  if (!row) return apiError(404, "not_found", `Comment not found: ${id}`);

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const raw = parsedBody.body;
  const parsed = updateCommentSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError(
      422,
      "validation_failed",
      "Request body failed validation",
      parsed.error.issues,
    );
  }

  await db
    .update(comments)
    .set({
      content: parsed.data.content,
      ...(parsed.data.mentions !== undefined
        ? { mentions: parsed.data.mentions }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(comments.id, id));

  const updated = await findComment(id);
  if (!updated) return apiError(404, "not_found", `Comment not found: ${id}`);
  return NextResponse.json({ comment: serializeComment(updated) });
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse | Response> {
  const { id } = await context.params;
  const row = await findComment(id);
  if (!row) return apiError(404, "not_found", `Comment not found: ${id}`);
  await db.delete(comments).where(eq(comments.id, id));
  return new Response(null, { status: 204 });
}
