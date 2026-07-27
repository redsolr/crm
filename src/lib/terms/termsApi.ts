/**
 * Terms-acceptance gate API client — `/v1/terms/*`.
 *
 * **Mirrors:** `platform/src/modules/terms/terms.response.dto.ts`
 * (`TermsStatusResponseDto` / `TermsAcceptanceResponseDto`) and
 * `terms.dto.ts` (`acceptTermsSchema` request shape). Canonical design:
 * `platform/docs/legal/terms-acceptance-gate-spec-2026-07-11.md` § 4.
 *
 * All three acceptance POSTs are interactive-session-only on the
 * platform, ride the cookie-auth path, and therefore carry the
 * `X-CSRF-Token` header — `BaseApiClient` attaches it automatically for
 * mutating methods. `GET /v1/terms/status` is exempt from the gate
 * (`@SkipTermsGate()`), so it is callable while every other `/v1/*`
 * request 403s — it's the gate screen's bootstrap.
 */

import { z } from "zod";
import { BaseApiClient } from "../api-client";
import { freshIdempotencyKey } from "../idempotency";
import { parseApiResponse } from "../chat/schemas";
import type { TermsLocale } from "./presentations";

export const TERMS_DOCUMENT_KEYS = ["tos", "privacy_notice", "ai_ack"] as const;
export type TermsDocumentKey = (typeof TERMS_DOCUMENT_KEYS)[number];

export const TERMS_CAPACITIES = [
  "organization_signatory",
  "authorized_user",
] as const;
export type TermsCapacity = (typeof TERMS_CAPACITIES)[number];

const TermsRequiredActionSchema = z.object({
  capacity: z.enum(TERMS_CAPACITIES),
  document_key: z.enum(TERMS_DOCUMENT_KEYS),
  version: z.string(),
  blocking: z.boolean(),
});

const TermsDocumentStatusSchema = z.object({
  key: z.enum(TERMS_DOCUMENT_KEYS),
  version: z.string(),
  revision: z.number(),
  hash: z.string(),
  url: z.string(),
  effective_at: z.string(),
  accepted: z.boolean(),
});

export const TermsStatusSchema = z.object({
  account: z.object({ email: z.string() }),
  documents: z.array(TermsDocumentStatusSchema),
  required_actions: z.array(TermsRequiredActionSchema),
  acceptance_required: z.boolean(),
  blocked_on_owner: z.boolean(),
  upcoming: z.array(
    z.object({
      document_key: z.enum(TERMS_DOCUMENT_KEYS),
      version: z.string(),
      effective_at: z.string(),
      change_summary: z.string().nullable(),
    }),
  ),
});

export type TermsStatus = z.infer<typeof TermsStatusSchema>;
export type TermsRequiredAction = z.infer<typeof TermsRequiredActionSchema>;
export type TermsDocumentStatus = z.infer<typeof TermsDocumentStatusSchema>;

export const TermsAcceptanceResponseSchema = z.object({
  recorded: z.boolean(),
  required_actions: z.array(TermsRequiredActionSchema),
  acceptance_required: z.boolean(),
});

export type TermsAcceptanceResponse = z.infer<
  typeof TermsAcceptanceResponseSchema
>;

export interface EchoedDocument {
  document_key: TermsDocumentKey;
  version: string;
}

class TermsApiClient extends BaseApiClient {
  async getStatus(): Promise<TermsStatus> {
    const raw = await this.request<unknown>("/terms/status");
    return parseApiResponse(TermsStatusSchema, "GET /terms/status", raw);
  }

  // The three acceptance POSTs are written out long-hand — literal
  // path + literal `headers: { "Idempotency-Key": ... }` per call site —
  // because two structural scanners (public-api-coverage,
  // idempotency-key-coverage) resolve routes and headers from the AST
  // and deliberately reject helper indirection.

  /** The § 6.1 gate screen — echoes the tos + privacy_notice versions rendered. */
  async acceptTos(
    localeDisplayed: TermsLocale,
    echoed: EchoedDocument[],
  ): Promise<TermsAcceptanceResponse> {
    const raw = await this.request<unknown>("/terms/tos_acceptances", {
      method: "POST",
      body: JSON.stringify({ locale_displayed: localeDisplayed, echoed }),
      headers: { "Idempotency-Key": freshIdempotencyKey() },
    });
    return parseApiResponse(
      TermsAcceptanceResponseSchema,
      "POST /terms/tos_acceptances",
      raw,
    );
  }

  /** The § 6.2 first-AI-use modal — echoes the ai_ack version rendered. */
  async acknowledgeAi(
    localeDisplayed: TermsLocale,
    echoed: EchoedDocument[],
  ): Promise<TermsAcceptanceResponse> {
    const raw = await this.request<unknown>("/terms/ai_acknowledgments", {
      method: "POST",
      body: JSON.stringify({ locale_displayed: localeDisplayed, echoed }),
      headers: { "Idempotency-Key": freshIdempotencyKey() },
    });
    return parseApiResponse(
      TermsAcceptanceResponseSchema,
      "POST /terms/ai_acknowledgments",
      raw,
    );
  }

  /** Standalone non-blocking privacy-update acknowledgment. */
  async acknowledgePrivacy(
    localeDisplayed: TermsLocale,
    echoed: EchoedDocument[],
  ): Promise<TermsAcceptanceResponse> {
    const raw = await this.request<unknown>("/terms/privacy_receipts", {
      method: "POST",
      body: JSON.stringify({ locale_displayed: localeDisplayed, echoed }),
      headers: { "Idempotency-Key": freshIdempotencyKey() },
    });
    return parseApiResponse(
      TermsAcceptanceResponseSchema,
      "POST /terms/privacy_receipts",
      raw,
    );
  }
}

export const termsApiClient = new TermsApiClient();
