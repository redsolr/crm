import type Anthropic from "@anthropic-ai/sdk";
import { ASK_TOOLS, ASK_TOOLS_BY_NAME } from "./ask-tools";
import { appendMessage, loadHistory } from "./chats";
import { anthropicClient, ASK_MODEL } from "./llm";

/**
 * Ask chat agentic loop (backend-swap: Ask chat) — the local
 * replacement for the platform's `POST /api/chats/{id}/responses`
 * workspace loop. Persistence lives in `chats.ts`; the LLM seam in
 * `llm.ts`; this module owns the loop and the SSE event grammar.
 *
 * Wire contract: the SSE event shapes `src/lib/chat/stream.ts` parses —
 * Anthropic-style events with the platform's camelCase field spelling
 * (`message.usage.inputTokens`, `delta.stopReason`, `usage.outputTokens`)
 * plus snake_case `tool_step` events (`tool_name` / `summary`) whose
 * summary is the raw tool-result content, exactly what the platform
 * emitted. The manual tool loop is deliberate: we re-emit a custom SSE
 * wire format the SDK tool runner doesn't produce.
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

export interface AskSseWriter {
  emit(eventType: string, data: Record<string, unknown>): Promise<void>;
}

/**
 * Run one Ask send: append the user input, loop model turns executing
 * sales tools between them, stream text deltas + tool_step events, and
 * persist the assistant's visible text when the turn settles.
 */
export async function runAskStream(
  chatId: string,
  input: string | null,
  writer: AskSseWriter,
  abortSignal: AbortSignal,
): Promise<void> {
  if (input !== null && input !== "") {
    await appendMessage(chatId, "user", input);
  }
  const messages: Anthropic.MessageParam[] = await loadHistory(chatId);
  if (messages.length === 0) {
    await writer.emit("error", {
      type: "error",
      error: { message: "Nothing to respond to — send a message first." },
    });
    return;
  }

  const tools = ASK_TOOLS.map((t) => t.definition);
  let visibleText = "";
  let outputTokens = 0;
  let messageStartEmitted = false;

  try {
    const client = anthropicClient();
    for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
      if (abortSignal.aborted) break;

      const stream = client.messages.stream({
        model: ASK_MODEL,
        max_tokens: MAX_OUTPUT_TOKENS,
        system: SYSTEM_PROMPT,
        // Final permitted turn runs without tools so the client always
        // gets a closing answer (the platform's loop-exhausted shape).
        tools: loop < MAX_TOOL_LOOPS - 1 ? tools : [],
        messages,
      });

      for await (const event of stream) {
        if (abortSignal.aborted) break;
        if (event.type === "message_start" && !messageStartEmitted) {
          messageStartEmitted = true;
          await writer.emit("message_start", {
            type: "message_start",
            message: {
              usage: { inputTokens: event.message.usage.input_tokens },
              model: event.message.model,
            },
          });
        } else if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          visibleText += event.delta.text;
          await writer.emit("content_block_delta", {
            type: "content_block_delta",
            index: event.index,
            delta: { type: "text_delta", text: event.delta.text },
          });
        }
      }
      if (abortSignal.aborted) break;

      const message = await stream.finalMessage();
      outputTokens += message.usage.output_tokens;

      if (message.stop_reason === "refusal") {
        await writer.emit("error", {
          type: "error",
          error: {
            message:
              "The model declined this request. Rephrase and try again.",
          },
        });
        return;
      }

      const toolUses = message.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );
      if (message.stop_reason !== "tool_use" || toolUses.length === 0) {
        break;
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const toolUse of toolUses) {
        const tool = ASK_TOOLS_BY_NAME.get(toolUse.name);
        const result = tool
          ? await tool.execute(toolUse.input as Record<string, unknown>)
          : { content: `Unknown tool "${toolUse.name}".`, isError: true };
        // The step summary IS the raw tool-result content — the shape
        // the platform emitted and the drawer renders as "✓ <summary>".
        await writer.emit("tool_step", {
          type: "tool_step",
          tool_name: toolUse.name,
          summary: result.content,
        });
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: result.content,
          ...(result.isError === true ? { is_error: true } : {}),
        });
      }
      messages.push({ role: "assistant", content: message.content });
      messages.push({ role: "user", content: toolResults });
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
