import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { savedViews } from "@/db/schema";
import { mintId } from "@/db/ids";
import { apiError, readJsonBody } from "@/server/api-error";
import { currentActor } from "@/server/actor";
import { CRM_WORKSPACE_ID } from "@/server/constants";
import { createViewSchema, serializeSavedView } from "@/server/views";
import { requireApiSession } from "@/server/api-auth";

/**
 * `GET /api/views?kind=&visibility=&owner=` → `{ data }` and
 * `POST /api/views` → `{ view }` — durable saved query specs for the
 * table/board surfaces. Single-tenant: `owner=me` (and any owner value)
 * resolves to the local actor stub, matching how records stamp authors.
 */

export async function GET(request: NextRequest): Promise<NextResponse> {
  const gate = await requireApiSession();
  if (!gate.ok) return gate.response;
  const params = request.nextUrl.searchParams;
  const conditions: SQL[] = [eq(savedViews.workspaceId, CRM_WORKSPACE_ID)];

  const kind = params.get("kind");
  if (kind !== null && kind !== "") conditions.push(eq(savedViews.kind, kind));

  const visibility = params.get("visibility");
  if (visibility !== null && visibility !== "") {
    conditions.push(eq(savedViews.visibility, visibility));
  }

  const owner = params.get("owner");
  if (owner !== null && owner !== "") {
    const me = owner === "me" ? (await currentActor()).id : owner;
    conditions.push(eq(savedViews.ownerAccountId, me));
  }

  const rows = await db
    .select()
    .from(savedViews)
    .where(and(...conditions))
    .orderBy(asc(savedViews.createdAt));
  return NextResponse.json({ data: rows.map(serializeSavedView) });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const gate = await requireApiSession();
  if (!gate.ok) return gate.response;
  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const parsed = createViewSchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    return apiError(
      422,
      "validation_failed",
      "Request body failed validation",
      parsed.error.issues,
    );
  }
  const body = parsed.data;

  const actor = await currentActor();
  const id = mintId("view");
  await db.insert(savedViews).values({
    id,
    name: body.name,
    kind: body.kind,
    visibility: body.visibility ?? "private",
    workspaceId: CRM_WORKSPACE_ID,
    ownerAccountId: actor.id,
    ownerName: actor.name,
    query: body.query ?? {},
  });

  const created = await db.query.savedViews.findFirst({
    where: (t, { eq: eqOp }) => eqOp(t.id, id),
  });
  if (!created) throw new Error(`Saved view ${id} vanished after insert`);
  return NextResponse.json(
    { view: serializeSavedView(created) },
    { status: 201 },
  );
}
