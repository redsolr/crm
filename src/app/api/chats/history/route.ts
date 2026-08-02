import { NextResponse } from "next/server";
import { listChats, serializeChat } from "@/server/chats";

/**
 * `GET /api/chats/history` — the Ask chat history rail. Serves the
 * legacy `ChatHistoryResponseSchema` envelope (`chats` + `total` +
 * `grouped`) the platform-era `getChatHistory` client already parses;
 * `grouped` ships empty — the standalone rail groups client-side by
 * relative time, not by the backend's date buckets.
 */
export async function GET(): Promise<NextResponse> {
  const rows = await listChats();
  return NextResponse.json({
    chats: rows.map(serializeChat),
    total: rows.length,
    grouped: {},
  });
}
