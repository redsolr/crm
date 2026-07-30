import { NextResponse, type NextRequest } from "next/server";
import { apiError, readJsonBody } from "@/server/api-error";
import { createChat, serializeChat } from "@/server/ask";

/**
 * `POST /v1/chats` — lazy Ask-conversation create (backend-swap: Ask
 * chat). Serves the flat `ChatResponseDto` shape `ChatResponseSchema`
 * parses. `account_id` / `page_id` arrive for wire compatibility;
 * single-tenant with no folders, both are ignored.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  if (typeof body !== "object" || body === null) {
    return apiError(422, "validation_failed", "Request body must be an object");
  }
  const rawTitle = (body as { title?: unknown }).title;
  if (rawTitle !== undefined && typeof rawTitle !== "string") {
    return apiError(422, "validation_failed", "title must be a string");
  }
  const title =
    typeof rawTitle === "string" && rawTitle.trim() !== ""
      ? rawTitle.slice(0, 200)
      : null;
  const chat = await createChat(title);
  return NextResponse.json(serializeChat(chat), { status: 201 });
}
