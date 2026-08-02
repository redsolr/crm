import { NextResponse } from "next/server";
import { apiError } from "@/server/api-error";
import { loadChat, loadMessages, serializeChat, serializeChatMessage } from "@/server/chats";

/**
 * `GET /api/chats/:id/messages` — reload a persisted Ask conversation
 * (the history rail's open path). Serves the
 * `ChatWithMessagesResponseSchema` shape: `{ chat, messages }`, turns
 * oldest-first. Tool steps are live-only (not persisted), so a reloaded
 * transcript shows each turn's final text.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const chat = await loadChat(id);
  if (chat === null) {
    return apiError(404, "not_found", `Chat ${id} not found`);
  }
  const messages = await loadMessages(id);
  return NextResponse.json({
    chat: serializeChat(chat),
    messages: messages.map(serializeChatMessage),
  });
}
