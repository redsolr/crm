import { NextResponse, type NextRequest } from "next/server";
import { mintId } from "@/db/ids";
import { apiError, readJsonBody } from "@/server/api-error";
import { openaiClient, ASK_MODEL } from "@/server/llm";
import { requireApiSession } from "@/server/api-auth";

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
  const gate = await requireApiSession();
  if (!gate.ok) return gate.response;
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
  if (!process.env.OPENAI_API_KEY) {
    return apiError(500, "llm_unavailable", "OPENAI_API_KEY is not configured");
  }

  try {
    const client = openaiClient();
    const response = await client.chat.completions.create({
      model: ASK_MODEL,
      max_completion_tokens: MAX_TOKENS,
      messages: [{ role: "user", content: question }],
    });
    const choice = response.choices[0];
    if (
      choice === undefined ||
      choice.finish_reason === "content_filter" ||
      choice.message.refusal
    ) {
      return apiError(400, "declined", "The model declined this request");
    }
    const text = choice.message.content ?? "";
    return NextResponse.json({
      id: mintId("resp"),
      object: "response",
      ask: "text",
      model: response.model,
      output: { text },
      sources: [],
      usage: {
        input_tokens: response.usage?.prompt_tokens ?? 0,
        output_tokens: response.usage?.completion_tokens ?? 0,
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
