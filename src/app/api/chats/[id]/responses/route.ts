import { type NextRequest } from "next/server";
import { apiError, readJsonBody } from "@/server/api-error";
import { runAskStream, type AskSseWriter } from "@/server/ask";
import { loadChat } from "@/server/chats";

/**
 * `POST /api/chats/{id}/responses` — Anthropic-style SSE streaming for
 * the Ask surface (backend-swap: Ask chat). The event grammar
 * `src/lib/chat/stream.ts` consumes: `message_start`,
 * `content_block_delta` (text_delta), `tool_step`, `message_delta`,
 * `message_stop`, `error` — all emitted by `runAskStream`.
 */

const encoder = new TextEncoder();

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  const chat = await loadChat(id);
  if (chat === null) {
    return apiError(404, "not_found", `Chat ${id} not found`);
  }

  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  if (typeof body !== "object" || body === null) {
    return apiError(422, "validation_failed", "Request body must be an object");
  }
  const rawInput = (body as { input?: unknown }).input;
  if (rawInput !== undefined && typeof rawInput !== "string") {
    return apiError(422, "validation_failed", "input must be a string");
  }
  const input = typeof rawInput === "string" ? rawInput : null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const writer: AskSseWriter = {
        // Synchronous enqueue behind a Promise seam so the loop code
        // reads naturally; a client disconnect surfaces as an enqueue
        // throw we swallow after marking the stream closed.
        emit(eventType, data) {
          if (closed) return Promise.resolve();
          try {
            controller.enqueue(
              encoder.encode(
                `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`,
              ),
            );
          } catch (err) {
            closed = true;
            console.warn(
              `[ask] SSE enqueue failed (client gone?) for chat ${id}:`,
              err,
            );
          }
          return Promise.resolve();
        },
      };

      void runAskStream(id, input, writer, request.signal)
        .catch((err) => {
          // runAskStream handles its own errors; this guards the seam.
          console.error(`[ask] unhandled stream failure for chat ${id}:`, err);
        })
        .finally(() => {
          if (!closed) {
            closed = true;
            try {
              controller.close();
            } catch (err) {
              console.warn(`[ask] SSE close failed for chat ${id}:`, err);
            }
          }
        });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
