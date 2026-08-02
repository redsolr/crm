import { asc, eq } from "drizzle-orm";
import { chatMessages, chats, db } from "@/db";
import { mintId } from "@/db/ids";

/**
 * Ask conversation persistence (chats + chat_messages), split from the
 * agentic loop in `ask.ts` so route handlers depend on storage without
 * dragging in the LLM seam. Durable history is user text + final
 * assistant text per turn; intra-turn tool traffic is deliberately not
 * persisted (the transcript UI lives client-side and follow-up turns
 * only need the conversational thread).
 */

export type ChatRow = typeof chats.$inferSelect;

/** History window per send — bounds prompt size on long conversations. */
const HISTORY_MESSAGE_LIMIT = 40;

/** Flat wire shape `ChatResponseSchema` in src/lib/chat/schemas.ts parses. */
export function serializeChat(row: ChatRow): Record<string, unknown> {
  return {
    id: row.id,
    title: row.title,
    page_id: null,
    findings_count: 0,
    parent_chat_id: null,
    branched_from_message_id: null,
    branch_name: null,
    starred: false,
    ephemeral: false,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function createChat(title: string | null): Promise<ChatRow> {
  const rows = await db
    .insert(chats)
    .values({ id: mintId("chat"), title })
    .returning();
  if (!rows[0]) throw new Error("Chat insert returned no row");
  return rows[0];
}

export async function loadChat(id: string): Promise<ChatRow | null> {
  const rows = await db.select().from(chats).where(eq(chats.id, id)).limit(1);
  return rows[0] ?? null;
}

/** One persisted conversational turn — provider-neutral (plain text). */
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export async function loadHistory(chatId: string): Promise<ChatTurn[]> {
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.chatId, chatId))
    .orderBy(asc(chatMessages.createdAt), asc(chatMessages.id));
  return rows.slice(-HISTORY_MESSAGE_LIMIT).map((row) => ({
    role: row.role === "assistant" ? "assistant" : "user",
    content: row.content,
  }));
}

export async function appendMessage(
  chatId: string,
  role: "user" | "assistant",
  content: string,
): Promise<void> {
  await db
    .insert(chatMessages)
    .values({ id: mintId("msg"), chatId, role, content });
  await db
    .update(chats)
    .set({ updatedAt: new Date() })
    .where(eq(chats.id, chatId));
}
