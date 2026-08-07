import { NextResponse } from "next/server";
import { apiError } from "@/server/api-error";
import { deleteChat } from "@/server/chats";
import { requireApiSession } from "@/server/api-auth";

/**
 * `DELETE /api/chats/:id` — remove a conversation from the Ask history
 * (messages cascade via the `chat_messages.chat_id` FK). Matches the
 * platform-era `chatApiClient.deleteChat` contract: 204 on success.
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const gate = await requireApiSession();
  if (!gate.ok) return gate.response;
  const { id } = await context.params;
  const deleted = await deleteChat(id);
  if (!deleted) {
    return apiError(404, "not_found", `Chat ${id} not found`);
  }
  return new NextResponse(null, { status: 204 });
}
