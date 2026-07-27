/**
 * Terms-gate 403 fan-out — the client half of the platform's
 * `TermsEnforcementInterceptor` contract.
 *
 * Every authenticated `/v1/*` request from an unaccepted principal gets
 * `403 { error: { code: 'terms_acceptance_required', meta: {
 * required_actions, blocked_on_owner, urls } } }`. This module inspects
 * that envelope and dispatches one of two window events (same pattern
 * as `auth:session-expired` in `authTokenManager`):
 *
 *  - `terms:acceptance-required` — the blocking ToS/privacy gate.
 *    `TermsGateListener` (mounted in the root layout) routes to the
 *    full-screen `/accept-terms` route.
 *  - `terms:ai-ack-required` — the 403 is SOLELY the first-AI-use
 *    acknowledgment (`required_actions` contains only `ai_ack`). That
 *    one is surface-scoped (spec § 6.2): `AiAckModalHost` opens the
 *    acknowledgment modal instead of yanking the user off their page.
 *
 * Call sites: `BaseApiClient.requestAtUrl` (every JSON API call) and
 * `handleStreamErrorResponse` in `chat/stream.ts` (the SSE path fetches
 * raw). Kept dependency-free so both can import it without cycles.
 */

export const TERMS_ACCEPTANCE_REQUIRED_EVENT = "terms:acceptance-required";
export const TERMS_AI_ACK_REQUIRED_EVENT = "terms:ai-ack-required";

export interface TermsGateMeta {
  required_actions: Array<{
    capacity: string;
    document_key: string;
    version: string;
    blocking: boolean;
  }>;
  blocked_on_owner: boolean;
}

/**
 * Extract the terms-gate meta from a 403 response body, or `null` when
 * the body is not a terms-gate envelope. Tolerant of missing meta (the
 * machine-principal variant carries only `blocked_on_owner` + urls).
 */
export function parseTermsGate403(body: unknown): TermsGateMeta | null {
  if (typeof body !== "object" || body === null) return null;
  const error = (body as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return null;
  const e = error as { code?: unknown; meta?: unknown };
  if (e.code !== "terms_acceptance_required") return null;

  const meta =
    typeof e.meta === "object" && e.meta !== null
      ? (e.meta as Record<string, unknown>)
      : {};
  const rawActions = Array.isArray(meta.required_actions)
    ? meta.required_actions
    : [];
  return {
    required_actions: rawActions.filter(
      (a): a is TermsGateMeta["required_actions"][number] =>
        typeof a === "object" &&
        a !== null &&
        typeof (a as { document_key?: unknown }).document_key === "string",
    ),
    blocked_on_owner: meta.blocked_on_owner === true,
  };
}

/**
 * True when the 403 is SOLELY the first-AI-use acknowledgment — the
 * surface-scoped case that opens the modal instead of the full gate.
 */
export function isAiAckOnly(meta: TermsGateMeta): boolean {
  return (
    meta.required_actions.length > 0 &&
    meta.required_actions.every((a) => a.document_key === "ai_ack")
  );
}

/**
 * Mount-race latch: gated 403s from a page's very first fetches can
 * fire BEFORE `TermsGateListener`'s effect has subscribed — a window
 * event dispatched then is simply lost, and if no later API call fires,
 * the user sits on a broken page instead of the gate. The dispatch
 * sets this flag; the listener consumes it on mount and navigates.
 */
let pendingGateNavigation = false;

/** One-shot read of a pre-listener gate dispatch (cleared on read). */
export function consumePendingTermsGateNavigation(): boolean {
  const pending = pendingGateNavigation;
  pendingGateNavigation = false;
  return pending;
}

/**
 * Inspect a 403 body and dispatch the matching gate event. Returns the
 * parsed meta when the body was a terms-gate envelope (so callers can
 * customize their own error surface), `null` otherwise. No-op outside
 * the browser (SSR / node fetch paths never gate a human).
 */
export function notifyTermsGate403(body: unknown): TermsGateMeta | null {
  const meta = parseTermsGate403(body);
  if (meta === null) return null;
  if (typeof window === "undefined") return meta;

  const onlyAiAck = isAiAckOnly(meta);

  if (!onlyAiAck) {
    pendingGateNavigation = true;
  }
  window.dispatchEvent(
    new CustomEvent(
      onlyAiAck ? TERMS_AI_ACK_REQUIRED_EVENT : TERMS_ACCEPTANCE_REQUIRED_EVENT,
      { detail: meta },
    ),
  );
  return meta;
}
