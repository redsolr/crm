"use client";

/**
 * Ask-Jurisimus product support — two transports over one contract:
 *
 *  - `supportApi` (authed, `/api/support/*`) — the in-app Help panel.
 *    Rides `BaseApiClient` (cookies + CSRF) like every authed surface.
 *  - `publicSupportApi` (anonymous, `/api/public/support/*`) — the
 *    landing-page widget. Raw `fetch`, same posture as
 *    `publicMatterChatApi`: no session, no CSRF to reflect.
 *
 * Platform module: `platform/src/modules/support/`.
 */

import { z } from "zod";
import { API_ROOT } from "@/lib/api-base";
import { BaseApiClient, buildApiError } from "@/lib/api-client";
import { freshIdempotencyKey } from "@/lib/idempotency";

export const SupportArticleSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
});
export type SupportArticle = z.infer<typeof SupportArticleSchema>;

export const SupportArticleListSchema = z.object({
  data: z.array(SupportArticleSchema),
});

/**
 * `answer === null` means the bot ABSTAINED (nothing in the KB grounded
 * an answer — no tokens were spent); show "message the team" instead of
 * prose. `remaining_today` is -1 on abstention (no quota consumed).
 */
export const SupportAskResponseSchema = z.object({
  answer: z.string().nullable(),
  sources: z.array(z.object({ id: z.string(), title: z.string() })),
  escalate: z.boolean(),
  remaining_today: z.number(),
});
export type SupportAskResponse = z.infer<typeof SupportAskResponseSchema>;

export const SupportMessageEnvelopeSchema = z.object({
  support_message: z.object({
    id: z.string(),
    status: z.string(),
    created_at: z.string(),
  }),
});
export type SupportMessageEnvelope = z.infer<
  typeof SupportMessageEnvelopeSchema
>;

export interface SupportMessageInput {
  message: string;
  question?: string;
  contact_email?: string;
}

class SupportApiClient extends BaseApiClient {
  async searchArticles(query: string): Promise<SupportArticle[]> {
    const qs = new URLSearchParams({ q: query });
    const res = await this.request<unknown>(`/support/articles?${qs}`);
    return SupportArticleListSchema.parse(res).data;
  }

  async ask(question: string): Promise<SupportAskResponse> {
    const res = await this.request<unknown>(`/support/ask`, {
      method: "POST",
      body: JSON.stringify({ question }),
      headers: { "Idempotency-Key": freshIdempotencyKey() },
    });
    return SupportAskResponseSchema.parse(res);
  }

  async leaveMessage(
    input: SupportMessageInput,
  ): Promise<SupportMessageEnvelope> {
    const res = await this.request<unknown>(`/support/messages`, {
      method: "POST",
      body: JSON.stringify(input),
      headers: { "Idempotency-Key": freshIdempotencyKey() },
    });
    return SupportMessageEnvelopeSchema.parse(res);
  }
}

export const supportApi = new SupportApiClient();

/** Anonymous transport for the landing widget (no cookies, no CSRF). */
async function publicRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_ROOT}/public/support${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!response.ok) throw await buildApiError(response);
  return schema.parse(await response.json());
}

export const publicSupportApi = {
  searchArticles(query: string): Promise<{ data: SupportArticle[] }> {
    const qs = new URLSearchParams({ q: query });
    return publicRequest(`/articles?${qs}`, SupportArticleListSchema);
  },
  ask(question: string): Promise<SupportAskResponse> {
    return publicRequest(`/ask`, SupportAskResponseSchema, {
      method: "POST",
      body: JSON.stringify({ question }),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": freshIdempotencyKey(),
      },
    });
  },
  leaveMessage(
    input: SupportMessageInput & { contact_email: string },
  ): Promise<SupportMessageEnvelope> {
    return publicRequest(`/messages`, SupportMessageEnvelopeSchema, {
      method: "POST",
      body: JSON.stringify(input),
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": freshIdempotencyKey(),
      },
    });
  },
};
