import type OpenAI from "openai";
import { ASK_TOOLS, ASK_TOOLS_BY_NAME } from "./ask-tools";
import { appendMessage, loadHistory } from "./chats";
import { ASK_AGENT_ACTOR } from "./constants";
import { openaiClient, ASK_MODEL } from "./llm";

/**
 * Ask chat agentic loop (backend-swap: Ask chat) — the local
 * replacement for the platform's `POST /api/chats/{id}/responses`
 * workspace loop. Persistence lives in `chats.ts`; the LLM seam in
 * `llm.ts` (OpenAI since 2026-08-02); this module owns the loop and
 * the SSE event grammar.
 *
 * Wire contract: the SSE event shapes `src/lib/chat/stream.ts` parses —
 * platform-era events with camelCase field spelling
 * (`message.usage.inputTokens`, `delta.stopReason`, `usage.outputTokens`)
 * plus snake_case `tool_step` events (`tool_name` / `summary`) whose
 * summary is the raw tool-result content. The grammar predates the
 * provider and stays IDENTICAL across the Anthropic→OpenAI port — the
 * FE never learns which vendor answered.
 */

/** Hard cap on model turns per send — the platform's MAX_TOOL_LOOPS shape. */
const MAX_TOOL_LOOPS = 8;

const MAX_OUTPUT_TOKENS = 16000;

const SYSTEM_PROMPT = [
  "You are the Ask assistant inside Jurisimus's internal sales CRM — the founder runs the 10-firm validation tour pipeline here. Records are work items: accounts (companies/firms), contacts, opportunities (pipeline deals, children of accounts), call notes, and commitments.",
  "Answer questions about the pipeline by looking records up with find_crm_record — ground answers in this CRM's records, never invent record data. Keep answers focused and concise.",
  "You have server-side tools that act on real records.",
  "- Complete EVERY action the user asked for by calling tools — one call per action. When a request needs multiple records (e.g. a company AND a deal, or a deal AND a call note), make each tool call in sequence before giving your final answer.",
  "- Never state that an action was completed unless a tool result in this conversation confirms it. If a tool failed or you stopped early, say exactly what was done and what was not.",
  "- Pass along every detail the user provided (amounts, dates, sizes, sources) as tool inputs; do not drop details silently.",
  "- Do not stop to ask about OPTIONAL fields the user did not mention — create the records with what you have; missing optional details can be filled in later. Only ask when a REQUIRED input is genuinely unknowable from the request.",
].join("\n");

/** Ask-tool registry → OpenAI function-tool declarations. */
const OPENAI_TOOLS: OpenAI.Chat.Completions.ChatCompletionTool[] =
  ASK_TOOLS.map((t) => ({
    type: "function",
    function: {
      name: t.definition.name,
      description: t.definition.description,
      parameters: t.definition.input_schema as unknown as Record<
        string,
        unknown
      >,
    },
  }));

export interface AskSseWriter {
  emit(eventType: string, data: Record<string, unknown>): Promise<void>;
}

/** Tool call assembled from streamed deltas (arguments arrive chunked). */
interface PendingToolCall {
  id: string;
  name: string;
  argumentsJson: string;
}

/**
 * Run one Ask send: append the user input, loop model turns executing
 * sales tools between them, stream text deltas + tool_step events, and
 * persist the assistant's visible text when the turn settles.
 *
 * `images` (pasted screenshots as data URLs) ride THIS turn only: the
 * current user message is sent to the model as multimodal content, but
 * chat history persists the text alone — a reloaded conversation shows
 * the words without the screenshots (same live-only rule as tool
 * steps).
 */
export async function runAskStream(
  chatId: string,
  input: string | null,
  writer: AskSseWriter,
  abortSignal: AbortSignal,
  images: string[] = [],
): Promise<void> {
  if (input !== null && input !== "") {
    await appendMessage(chatId, "user", input);
  }
  const history = await loadHistory(chatId);
  if (history.length === 0) {
    await writer.emit("error", {
      type: "error",
      error: { message: "Nothing to respond to — send a message first." },
    });
    return;
  }

  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history,
  ];

  // Attach the screenshots to the CURRENT user turn as image parts.
  if (images.length > 0) {
    const last = messages[messages.length - 1];
    if (last !== undefined && last.role === "user") {
      const text = typeof last.content === "string" ? last.content : "";
      messages[messages.length - 1] = {
        role: "user",
        content: [
          ...(text !== "" ? [{ type: "text" as const, text }] : []),
          ...images.map((url) => ({
            type: "image_url" as const,
            image_url: { url },
          })),
        ],
      };
    }
  }

  let visibleText = "";
  let outputTokens = 0;
  let messageStartEmitted = false;

  try {
    const client = openaiClient();
    for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
      if (abortSignal.aborted) break;

      const stream = await client.chat.completions.create({
        model: ASK_MODEL,
        max_completion_tokens: MAX_OUTPUT_TOKENS,
        // Final permitted turn runs without tools so the client always
        // gets a closing answer (the platform's loop-exhausted shape).
        ...(loop < MAX_TOOL_LOOPS - 1 ? { tools: OPENAI_TOOLS } : {}),
        messages,
        stream: true,
        stream_options: { include_usage: true },
      });

      let turnText = "";
      let finishReason: string | null = null;
      const toolCalls: PendingToolCall[] = [];

      for await (const chunk of stream) {
        if (abortSignal.aborted) break;
        if (!messageStartEmitted && chunk.model) {
          messageStartEmitted = true;
          // OpenAI reports usage at stream END; the grammar carries the
          // prompt count in message_start, so it reads 0 here and the
          // authoritative outputTokens ride message_delta at the end.
          await writer.emit("message_start", {
            type: "message_start",
            message: { usage: { inputTokens: 0 }, model: chunk.model },
          });
        }
        if (chunk.usage) {
          outputTokens += chunk.usage.completion_tokens ?? 0;
        }
        const choice = chunk.choices[0];
        if (choice === undefined) continue;
        if (choice.finish_reason) finishReason = choice.finish_reason;

        const delta = choice.delta;
        if (typeof delta.content === "string" && delta.content !== "") {
          turnText += delta.content;
          visibleText += delta.content;
          await writer.emit("content_block_delta", {
            type: "content_block_delta",
            index: 0,
            delta: { type: "text_delta", text: delta.content },
          });
        }
        for (const tc of delta.tool_calls ?? []) {
          const slot = (toolCalls[tc.index] ??= {
            id: "",
            name: "",
            argumentsJson: "",
          });
          if (tc.id) slot.id = tc.id;
          if (tc.function?.name) slot.name += tc.function.name;
          if (tc.function?.arguments) slot.argumentsJson += tc.function.arguments;
        }
      }
      if (abortSignal.aborted) break;

      if (finishReason === "content_filter") {
        await writer.emit("error", {
          type: "error",
          error: {
            message:
              "The model declined this request. Rephrase and try again.",
          },
        });
        return;
      }

      const settledCalls = toolCalls.filter((c) => c.id !== "" && c.name !== "");
      if (finishReason !== "tool_calls" || settledCalls.length === 0) {
        break;
      }

      messages.push({
        role: "assistant",
        content: turnText === "" ? null : turnText,
        tool_calls: settledCalls.map((c) => ({
          id: c.id,
          type: "function",
          function: { name: c.name, arguments: c.argumentsJson || "{}" },
        })),
      });

      for (const call of settledCalls) {
        const tool = ASK_TOOLS_BY_NAME.get(call.name);
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(call.argumentsJson || "{}") as Record<
            string,
            unknown
          >;
        } catch (err) {
          console.warn(
            `[ask] unparseable arguments for ${call.name}:`,
            err,
          );
        }
        const result = tool
          ? await tool.execute(args, ASK_AGENT_ACTOR)
          : { content: `Unknown tool "${call.name}".`, isError: true };
        // The step summary IS the raw tool-result content — the shape
        // the platform emitted and the drawer renders as "✓ <summary>".
        await writer.emit("tool_step", {
          type: "tool_step",
          tool_name: call.name,
          summary: result.content,
        });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: result.content,
        });
      }
    }

    if (visibleText !== "") {
      await appendMessage(chatId, "assistant", visibleText);
    }
    await writer.emit("message_delta", {
      type: "message_delta",
      delta: { stopReason: "end_turn" },
      usage: { outputTokens },
    });
    await writer.emit("message_stop", { type: "message_stop" });
  } catch (err) {
    console.error(`[ask] stream failed for chat ${chatId}:`, err);
    // Best-effort: persist whatever streamed before the failure so the
    // conversation thread stays coherent on the next send.
    if (visibleText !== "") {
      await appendMessage(chatId, "assistant", visibleText).catch(
        (persistErr) => {
          console.error(
            `[ask] failed to persist partial answer for chat ${chatId}:`,
            persistErr,
          );
        },
      );
    }
    await writer.emit("error", {
      type: "error",
      error: {
        message:
          err instanceof Error ? err.message : "Ask stream failed — try again.",
      },
    });
  }
}
