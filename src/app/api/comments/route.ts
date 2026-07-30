import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db, comments } from "@/db";
import { mintId } from "@/db/ids";
import { apiError, readJsonBody } from "@/server/api-error";
import { logActivity } from "@/server/activities";
import { LOCAL_ACTOR_ID } from "@/server/constants";
import { serializeComment } from "@/server/comments";
import { loadWorkItem } from "@/server/work-items";

/** `POST /api/comments` → `{ comment }` + a `comment_added` activity. */

const createCommentSchema = z.object({
  content: z.string().min(1).max(20_000),
  work_item_id: z.string(),
  mentions: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const parsedBody = await readJsonBody(request);
  if (!parsedBody.ok) return parsedBody.response;
  const raw = parsedBody.body;
  const parsed = createCommentSchema.safeParse(raw);
  if (!parsed.success) {
    return apiError(
      422,
      "validation_failed",
      "Request body failed validation",
      parsed.error.issues,
    );
  }
  const body = parsed.data;

  const item = await loadWorkItem(body.work_item_id);
  if (!item) {
    return apiError(
      422,
      "validation_failed",
      `work_item_id does not reference an existing work item: ${body.work_item_id}`,
    );
  }

  const id = mintId("cmt");
  await db.insert(comments).values({
    id,
    workItemId: body.work_item_id,
    content: body.content,
    authorId: LOCAL_ACTOR_ID,
    mentions: body.mentions ?? [],
  });

  await logActivity({
    type: "comment_added",
    entityId: item.record.id,
    entityIdentifier: item.record.identifier,
    metadata: { comment_id: id },
  });

  const created = await db.query.comments.findFirst({
    where: (t, { eq }) => eq(t.id, id),
  });
  if (!created) throw new Error(`Comment ${id} vanished after insert`);
  return NextResponse.json({ comment: serializeComment(created) }, { status: 201 });
}
