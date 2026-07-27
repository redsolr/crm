/**
 * Terms-acceptance-gate mocks (mocked tier).
 *
 * Wire shapes mirror `platform/src/modules/terms/terms.response.dto.ts`
 * (`TermsStatusResponseDto` / `TermsAcceptanceResponseDto`) and the
 * platform's 403 envelope from `TermsPolicyService.buildGateException`.
 * Factories validate through the FE's own Zod schemas
 * (`src/lib/terms/termsApi.ts`) per the shared.ts factory doctrine —
 * mock/production drift is structurally prevented.
 */

import type { Page } from "@playwright/test";
import {
  TermsStatusSchema,
  TermsAcceptanceResponseSchema,
  type TermsStatus,
  type TermsAcceptanceResponse,
  type TermsRequiredAction,
} from "../../src/lib/terms/termsApi";

const DOC_URLS = {
  tos: "/legal/terms",
  privacy_notice: "/legal/privacy",
  ai_ack: "/legal/terms#ai-acknowledgment",
} as const;

const VERSION = "1.0.0-draft";
const EFFECTIVE_AT = "2026-07-01T00:00:00.000Z";

export function createTermsStatus(overrides: {
  requiredActions?: TermsRequiredAction[];
  blockedOnOwner?: boolean;
  email?: string;
  version?: string;
}): TermsStatus {
  const required = overrides.requiredActions ?? [];
  const blockedOnOwner = overrides.blockedOnOwner ?? false;
  const version = overrides.version ?? VERSION;
  const requiredKeys = new Set(required.map((a) => a.document_key));
  const wire: TermsStatus = {
    account: { email: overrides.email ?? "e2e-test@jurisimus.com" },
    documents: (["tos", "privacy_notice", "ai_ack"] as const).map((key) => ({
      key,
      version,
      revision: 1,
      hash: `hash-${key}-e2e`,
      url: DOC_URLS[key],
      effective_at: EFFECTIVE_AT,
      accepted: !requiredKeys.has(key) && !blockedOnOwner,
    })),
    required_actions: required,
    acceptance_required: required.some((a) => a.blocking) || blockedOnOwner,
    blocked_on_owner: blockedOnOwner,
    upcoming: [],
  };
  return TermsStatusSchema.parse(wire);
}

/** The fully-accepted state — the default every unrelated suite sees. */
export function createAcceptedTermsStatus(): TermsStatus {
  return createTermsStatus({});
}

export function createOwnerGateStatus(version = VERSION): TermsStatus {
  return createTermsStatus({
    version,
    requiredActions: [
      {
        capacity: "organization_signatory",
        document_key: "tos",
        version,
        blocking: true,
      },
      {
        capacity: "authorized_user",
        document_key: "tos",
        version,
        blocking: true,
      },
      {
        capacity: "authorized_user",
        document_key: "privacy_notice",
        version,
        blocking: false,
      },
      {
        capacity: "authorized_user",
        document_key: "ai_ack",
        version,
        blocking: false,
      },
    ],
  });
}

export function createMemberGateStatus(version = VERSION): TermsStatus {
  return createTermsStatus({
    version,
    requiredActions: [
      {
        capacity: "authorized_user",
        document_key: "tos",
        version,
        blocking: true,
      },
      {
        capacity: "authorized_user",
        document_key: "privacy_notice",
        version,
        blocking: false,
      },
    ],
  });
}

export function createAiAckOnlyStatus(version = VERSION): TermsStatus {
  return createTermsStatus({
    version,
    requiredActions: [
      {
        capacity: "authorized_user",
        document_key: "ai_ack",
        version,
        blocking: false,
      },
    ],
  });
}

export function createAcceptanceResponse(
  overrides: { acceptanceRequired?: boolean } = {},
): TermsAcceptanceResponse {
  const wire: TermsAcceptanceResponse = {
    recorded: true,
    required_actions: [],
    acceptance_required: overrides.acceptanceRequired ?? false,
  };
  return TermsAcceptanceResponseSchema.parse(wire);
}

/** The platform's terms-gate 403 envelope (TermsPolicyService.buildGateException). */
export function createTermsGate403Body(status: TermsStatus): unknown {
  return {
    error: {
      type: "permission_error",
      code: "terms_acceptance_required",
      message:
        "The current Terms of Service must be accepted before using the Service.",
      doc_url: "https://docs.jurisimus.com/errors/terms_acceptance_required",
      meta: {
        required_actions: status.required_actions,
        blocked_on_owner: status.blocked_on_owner,
        urls: {
          terms: "/legal/terms",
          privacy: "/legal/privacy",
          status: "/v1/terms/status",
        },
      },
    },
  };
}

/** The 409 stale-echo envelope from the acceptance endpoints. */
export function createTermsStale409Body(): unknown {
  return {
    error: {
      type: "invalid_request_error",
      code: "terms_version_stale",
      message:
        "The echoed document versions no longer match the current offer — re-fetch /v1/terms/status and re-render.",
      doc_url: "https://docs.jurisimus.com/errors/terms_version_stale",
    },
  };
}

/**
 * Default handler for unrelated suites: `GET /v1/terms/status` returns
 * the fully-accepted state. Registered in the auth fixture so the
 * proactive ai_ack pre-flight before the first chat send never trips
 * the hermetic tripwire (and never opens the modal) in specs that
 * aren't about the gate.
 */
export async function setupTermsHandlers(page: Page): Promise<void> {
  await page.route(
    (url) => url.pathname === "/v1/terms/status",
    async (route, request) => {
      if (request.method() !== "GET") return route.fallback();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createAcceptedTermsStatus()),
      });
    },
  );
}
