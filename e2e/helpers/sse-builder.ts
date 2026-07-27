/**
 * SSE stream builder for mocking Anthropic-style chat streaming.
 *
 * Produces events matching the exact format parsed by src/lib/chat/stream.ts startChatStream():
 *   message_start → content_block_start → content_block_delta(s)
 *   → content_block_stop → message_delta → message_stop
 *
 * Each event is formatted as:
 *   event: <type>\ndata: <json>\n\n
 */

interface SSEEvent {
  event: string;
  data: string;
}

function formatEvents(events: SSEEvent[]): string {
  return events.map((e) => `event: ${e.event}\ndata: ${e.data}\n\n`).join("");
}

/**
 * Build a complete SSE stream for a successful chat response.
 */
export function buildSSEStream(options: {
  content: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  chunkSize?: number;
  /**
   * Server-side tool steps to emit before the final answer — the
   * matter-scoped agentic loop (`tool_step` SSE events). Each renders as
   * "✓ <summary>" and triggers the Matters Lab query invalidation. Mirrors
   * what `ChatResponsesController` emits between the buffered tool turns and
   * the final streamed answer. `citations` carries the grounded authority a
   * `search_legal_corpus` step returned (used to anchor a captured finding).
   */
  toolSteps?: Array<{
    tool_name: string;
    summary: string;
    citations?: string[];
  }>;
}): string {
  const {
    content,
    model = "gpt-5-nano",
    inputTokens = 100,
    outputTokens = 50,
    chunkSize = 20,
    toolSteps = [],
  } = options;

  const events: SSEEvent[] = [];

  // 0. tool_step events (matter-scoped agentic loop) — emitted first, before
  // the final answer, matching the backend's phase-1-then-stream ordering.
  for (const step of toolSteps) {
    events.push({
      event: "tool_step",
      data: JSON.stringify({
        type: "tool_step",
        tool_name: step.tool_name,
        summary: step.summary,
        ...(step.citations ? { citations: step.citations } : {}),
      }),
    });
  }

  // 1. message_start
  events.push({
    event: "message_start",
    data: JSON.stringify({
      type: "message_start",
      message: {
        id: `msg_${Date.now()}`,
        type: "message",
        role: "assistant",
        model,
        stopReason: null,
        usage: { inputTokens },
      },
    }),
  });

  // 2. content_block_start (text block at index 0)
  events.push({
    event: "content_block_start",
    data: JSON.stringify({
      type: "content_block_start",
      index: 0,
      contentBlock: { type: "text", text: "" },
    }),
  });

  // 3. content_block_delta chunks
  for (let i = 0; i < content.length; i += chunkSize) {
    const chunk = content.slice(i, i + chunkSize);
    events.push({
      event: "content_block_delta",
      data: JSON.stringify({
        type: "content_block_delta",
        index: 0,
        delta: { type: "text_delta", text: chunk },
      }),
    });
  }

  // 4. content_block_stop
  events.push({
    event: "content_block_stop",
    data: JSON.stringify({
      type: "content_block_stop",
      index: 0,
    }),
  });

  // 5. message_delta (with stop reason)
  events.push({
    event: "message_delta",
    data: JSON.stringify({
      type: "message_delta",
      usage: { outputTokens },
      delta: { stopReason: "end_turn" },
    }),
  });

  // 6. message_stop
  events.push({
    event: "message_stop",
    data: JSON.stringify({ type: "message_stop" }),
  });

  return formatEvents(events);
}

/**
 * Build an SSE stream that emits an error event.
 */
export function buildSSEErrorStream(errorMessage: string): string {
  return formatEvents([
    {
      event: "error",
      data: JSON.stringify({
        type: "error",
        error: { type: "server_error", message: errorMessage },
      }),
    },
  ]);
}
