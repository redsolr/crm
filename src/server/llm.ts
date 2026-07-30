import Anthropic from "@anthropic-ai/sdk";

/**
 * The single LLM seam for every paid call this backend makes (Ask
 * agentic loop, attribute `/compute` enrichment, interview-suggest
 * `/api/responses`). One place for the model policy and the
 * fail-loudly client guard — no fallback when the key is missing
 * (billing discipline): callers surface the thrown message.
 */

/** Server-side model policy — the FE's requested model is ignored. */
export const ASK_MODEL = process.env.CRM_ASK_MODEL ?? "claude-opus-5";

export function anthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "ANTHROPIC_API_KEY is not configured — the Ask assistant cannot run.",
    );
  }
  return new Anthropic();
}

/** Concatenated text blocks of a response (tool_use/thinking skipped). */
export function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
}
