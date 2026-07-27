import { z } from "zod";
import { BaseApiClient } from "./api-client";
import { freshIdempotencyKey } from "./idempotency";

/**
 * Client for the platform's `/v1/responses` LLM-native reasoning
 * endpoint. The endpoint is a discriminated union on `ask`; V0.1
 * supports `ask: "text"` (free-form question over `context_refs`)
 * and `ask: "founder_brief"` (execution-intelligence brief over the
 * active iteration).
 *
 * Wire shape mirrored from `platform/src/modules/responses/`. Kept
 * in lockstep via the Zod schemas below — every brief response is
 * parsed before reaching React Query so a backend wire-shape drift
 * surfaces at the network boundary, not in a buried render bug.
 */

// ───────────────────────────────────────────────────────────────────
// Zod schemas — mirror of backend DTOs.
// ───────────────────────────────────────────────────────────────────

const responseSourceSchema = z.object({
  type: z.union([z.literal("work_item"), z.literal("iteration")]),
  id: z.string(),
  compressed_context_version: z.number().int().nullable(),
});

const founderBriefSeveritySchema = z.union([
  z.literal("low"),
  z.literal("medium"),
  z.literal("high"),
]);

const founderBriefItemSchema = z.object({
  title: z.string(),
  reason: z.string(),
  severity: founderBriefSeveritySchema,
  sources: z.array(z.string()),
});

const founderBriefOutputSchema = z.object({
  top_risks: z.array(founderBriefItemSchema),
  blocked_execution: z.array(founderBriefItemSchema),
  slipping_commitments: z.array(founderBriefItemSchema),
  needs_founder_attention: z.array(founderBriefItemSchema),
  missing_context: z.array(founderBriefItemSchema),
  sources: z.array(responseSourceSchema),
});

export const founderBriefResponseSchema = z.object({
  id: z.string(),
  object: z.literal("response"),
  ask: z.literal("founder_brief"),
  model: z.string(),
  output: founderBriefOutputSchema,
  sources: z.array(responseSourceSchema),
  usage: z.object({
    input_tokens: z.number().int(),
    output_tokens: z.number().int(),
  }),
});

/** `ask: "text"` — free-form question, plain-text answer. Used by the
 *  CRM's live-interview AI follow-up suggestions (no context_refs —
 *  the interview transcript travels inline in the question). */
export const textResponseSchema = z.object({
  id: z.string(),
  object: z.literal("response"),
  ask: z.literal("text"),
  model: z.string(),
  output: z.object({ text: z.string() }),
  sources: z.array(responseSourceSchema),
  usage: z.object({
    input_tokens: z.number().int(),
    output_tokens: z.number().int(),
  }),
});

export type ResponseSource = z.infer<typeof responseSourceSchema>;
export type TextResponse = z.infer<typeof textResponseSchema>;
export type FounderBriefSeverity = z.infer<typeof founderBriefSeveritySchema>;
export type FounderBriefItem = z.infer<typeof founderBriefItemSchema>;
export type FounderBriefOutput = z.infer<typeof founderBriefOutputSchema>;
export type FounderBriefResponse = z.infer<typeof founderBriefResponseSchema>;

// ───────────────────────────────────────────────────────────────────
// API client
// ───────────────────────────────────────────────────────────────────

export type FounderBriefHorizon = "this_week";

export interface CreateFounderBriefRequest {
  horizon: FounderBriefHorizon;
  model?: string;
}

class ResponsesApiClient extends BaseApiClient {
  /**
   * `POST /v1/responses { ask: "founder_brief" }`.
   *
   * Hits the platform endpoint, validates the response with Zod, and
   * surfaces the typed shape. Idempotency-Key is set per call so a
   * retry on the same generated key short-circuits to the cached
   * response — keeps token cost bounded when the user mashes
   * "Regenerate".
   */
  async generateFounderBrief(
    request: CreateFounderBriefRequest,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<FounderBriefResponse> {
    const raw = await this.request<unknown>("/responses", {
      method: "POST",
      body: JSON.stringify({
        ask: "founder_brief",
        input: { horizon: request.horizon },
        ...(request.model !== undefined && { model: request.model }),
      }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return founderBriefResponseSchema.parse(raw);
  }

  /**
   * `POST /v1/responses { ask: "text" }`.
   *
   * Free-form question (≤8000 chars server-side), plain-text answer.
   * Same Idempotency-Key discipline as the founder brief: a fresh key
   * per deliberate click, so retries of the SAME click short-circuit
   * to the cached response instead of double-spending tokens.
   */
  async askText(
    question: string,
    idempotencyKey: string = freshIdempotencyKey(),
  ): Promise<TextResponse> {
    const raw = await this.request<unknown>("/responses", {
      method: "POST",
      body: JSON.stringify({ ask: "text", input: { question } }),
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return textResponseSchema.parse(raw);
  }
}

export const responsesApiClient = new ResponsesApiClient();
