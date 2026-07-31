import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { savedViews } from "@/db/schema";
import { apiError, readJsonBody } from "@/server/api-error";
import { serializeSavedView, updateViewSchema } from "@/server/views";

/** `PATCH` / `DELETE` `/api/views/:id`. */

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function findView(id: string) {
  return db.query.savedViews.findFirst({
    where: (t, { eq: eqOp }) => eqOp(t.id, id),
  });
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;
  const row = await findView(id);
  if (!row) return apiError(404, "not_found", `Saved view not found: ${id}`);

  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const parsed = updateViewSchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    return apiError(
      422,
      "validation_failed",
      "Request body failed validation",
      parsed.error.issues,
    );
  }
  const body = parsed.data;

  await db
    .update(savedViews)
    .set({
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.visibility !== undefined
        ? { visibility: body.visibility }
        : {}),
      ...(body.query !== undefined ? { query: body.query } : {}),
      updatedAt: new Date(),
    })
    .where(eq(savedViews.id, id));

  const updated = await findView(id);
  if (!updated) throw new Error(`Saved view ${id} vanished after update`);
  return NextResponse.json({ view: serializeSavedView(updated) });
}

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  const { id } = await context.params;
  const row = await findView(id);
  if (!row) return apiError(404, "not_found", `Saved view not found: ${id}`);
  await db.delete(savedViews).where(eq(savedViews.id, id));
  return new NextResponse(null, { status: 204 });
}
