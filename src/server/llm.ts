import OpenAI from "openai";

/**
 * The single LLM seam for every paid call this backend makes (Ask
 * agentic loop, attribute `/compute` enrichment, interview-suggest
 * `/api/responses`). One place for the model policy and the
 * fail-loudly client guard — no fallback when the key is missing
 * (billing discipline): callers surface the thrown message.
 *
 * Backend LLM is OpenAI (founder decision 2026-08-02, org `jurisima`);
 * the Anthropic client this replaced was never configured in prod.
 */

/** Server-side model policy — the FE's requested model is ignored. */
export const ASK_MODEL = process.env.CRM_ASK_MODEL ?? "gpt-5.4-mini";

/** Speech-to-text model for call recordings — OpenAI's current
 *  recommended transcription model (`whisper-1` is the legacy path). */
export const TRANSCRIBE_MODEL =
  process.env.CRM_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe";

export function openaiClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not configured — the Ask assistant cannot run.",
    );
  }
  return new OpenAI();
}
