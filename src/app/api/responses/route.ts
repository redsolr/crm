import { NextResponse, type NextRequest } from "next/server";
import { mintId } from "@/db/ids";
import { apiError, readJsonBody } from "@/server/api-error";
import { anthropicClient, ASK_MODEL, extractText } from "@/server/llm";

/**
 * `POST /api/responses` — local replacement for the platform's
 * LLM-native reasoning endpoint, scoped to what the CRM consumes:
 * `ask: "text"` (interview mode's AI follow-up suggestions — the
 * transcript travels inline in `input.question`). Other asks
 * (`founder_brief` is a web-app surface) answer 422.
 *
 * Wire shape per `src/lib/responsesApi.ts` `textResponseSchema`.
 */

const MAX_QUESTION_CHARS = 8000;
const MAX_TOKENS = 2048;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) return parsed.response;
  const body = parsed.body;
  if (typeof body !== "object" || body === null) {
    return apiError(422, "validation_failed", "Request body must be an object");
  }
  const { ask, input } = body as { ask?: unknown; input?: unknown };
  if (ask !== "text") {
    return apiError(
      422,
      "validation_failed",
      `Unsupported ask "${String(ask)}" — this CRM serves ask: "text" only`,
    );
  }
  const question =
    typeof input === "object" &&
    input !== null &&
    typeof (input as { question?: unknown }).question === "string"
      ? (input as { question: string }).question
      : null;
  if (question === null || question.trim() === "") {
    return apiError(422, "validation_failed", "input.question is required");
  }
  if (question.length > MAX_QUESTION_CHARS) {
    return apiError(
      422,
      "validation_failed",
      `input.question exceeds ${MAX_QUESTION_CHARS} characters`,
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return apiError(500, "llm_unavailable", "ANTHROPIC_API_KEY is not configured");
  }

  try {
    const client = anthropicClient();
    const response = await client.messages.create({
      model: ASK_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: question }],
    });
    if (response.stop_reason === "refusal") {
      return apiError(400, "declined", "The model declined this request");
    }
    const text = extractText(response.content);
    return NextResponse.json({
      id: mintId("resp"),
      object: "response",
      ask: "text",
      model: response.model,
      output: { text },
      sources: [],
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
    });
  } catch (err) {
    console.error("[responses] ask:text failed:", err);
    return apiError(
      502,
      "llm_failed",
      err instanceof Error ? err.message : "LLM request failed",
    );
  }
}
