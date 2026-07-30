import { comments } from "@/db";
import { LOCAL_ACTOR_ID } from "./constants";

/**
 * Comments family serializers. The author projection is the
 * placeholder local actor until standalone WorkOS auth (swap step 6)
 * introduces a real user identity.
 */

type CommentRow = typeof comments.$inferSelect;

export function serializeComment(row: CommentRow): Record<string, unknown> {
  return {
    id: row.id,
    content: row.content,
    work_item_id: row.workItemId,
    author_id: row.authorId,
    mentions: row.mentions,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function authorPayloadFor(authorId: string): { id: string; email: string } {
  return {
    id: authorId,
    email: authorId === LOCAL_ACTOR_ID ? "local@crm.internal" : `${authorId}@crm.internal`,
  };
}
