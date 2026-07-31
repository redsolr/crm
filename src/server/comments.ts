import { comments } from "@/db";
import { LOCAL_ACTOR_ID } from "./constants";

/**
 * Comments family serializers. Author identity is stored per row
 * (team attribution, swap step 6 — 2026-07-31); rows written before
 * the columns existed fall back to the placeholder projection.
 */

type CommentRow = typeof comments.$inferSelect;

export function serializeComment(row: CommentRow): Record<string, unknown> {
  return {
    id: row.id,
    content: row.content,
    work_item_id: row.workItemId,
    author_id: row.authorId,
    author: authorPayloadFor(row),
    mentions: row.mentions,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function authorPayloadFor(row: {
  authorId: string;
  authorName?: string | null;
  authorEmail?: string | null;
}): { id: string; name: string | null; email: string } {
  return {
    id: row.authorId,
    name: row.authorName ?? null,
    email:
      row.authorEmail ??
      (row.authorId === LOCAL_ACTOR_ID
        ? "local@crm.internal"
        : `${row.authorId}@crm.internal`),
  };
}
